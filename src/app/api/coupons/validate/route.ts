import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { code } = await req.json();

        if (!code || typeof code !== "string") {
            return NextResponse.json(
                { valid: false, error: "Missing coupon code" },
                { status: 400 }
            );
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json(
                { valid: false, error: "Service unavailable" },
                { status: 503 }
            );
        }

        // Fetch coupon from Supabase
        const res = await fetch(
            `${supabaseUrl}/rest/v1/coupons?code=eq.${encodeURIComponent(code.toUpperCase())}&is_active=eq.true&select=*`,
            {
                headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                },
            }
        );

        if (!res.ok) {
            return NextResponse.json(
                { valid: false, error: "Failed to validate" },
                { status: 500 }
            );
        }

        const coupons = await res.json();

        if (coupons.length === 0) {
            return NextResponse.json({ valid: false, error: "invalid" });
        }

        const coupon = coupons[0];

        // Check expiry
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
            return NextResponse.json({ valid: false, error: "expired" });
        }

        // Check usage limit
        if (coupon.max_uses && coupon.usage_count >= coupon.max_uses) {
            return NextResponse.json({ valid: false, error: "max_uses_reached" });
        }

        return NextResponse.json({
            valid: true,
            coupon: {
                id: coupon.id,
                code: coupon.code,
                discount_type: coupon.discount_type,
                discount_value: parseFloat(coupon.discount_value),
                min_order_amount: coupon.min_order_amount
                    ? parseFloat(coupon.min_order_amount)
                    : null,
            },
        });
    } catch {
        return NextResponse.json(
            { valid: false, error: "Server error" },
            { status: 500 }
        );
    }
}
