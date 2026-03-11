import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { code, cartItems, customerEmail } = await req.json();

        if (!code || typeof code !== "string") {
            return NextResponse.json(
                { valid: false, error: "Missing coupon code" },
                { status: 400 }
            );
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json(
                { valid: false, error: "Service unavailable" },
                { status: 503 }
            );
        }

        const headers = {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
        };

        // Fetch coupon
        const res = await fetch(
            `${supabaseUrl}/rest/v1/coupons?code=eq.${encodeURIComponent(code.toUpperCase())}&is_active=eq.true&select=*`,
            { headers }
        );

        if (!res.ok) {
            return NextResponse.json({ valid: false, error: "Failed to validate" }, { status: 500 });
        }

        const coupons = await res.json();
        if (coupons.length === 0) {
            return NextResponse.json({ valid: false, error: "invalid" });
        }

        const coupon = coupons[0];

        // Check start date
        if (coupon.valid_from && new Date(coupon.valid_from) > new Date()) {
            return NextResponse.json({ valid: false, error: "not_yet_active" });
        }

        // Check expiry
        if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
            return NextResponse.json({ valid: false, error: "expired" });
        }

        // Check total usage limit
        if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
            return NextResponse.json({ valid: false, error: "max_uses_reached" });
        }

        // Check per-customer limit
        if (coupon.per_customer_limit && customerEmail) {
            const usageRes = await fetch(
                `${supabaseUrl}/rest/v1/coupon_usage?coupon_id=eq.${coupon.id}&customer_email=eq.${encodeURIComponent(customerEmail)}&select=id`,
                { headers }
            );
            if (usageRes.ok) {
                const usages = await usageRes.json();
                if (usages.length >= coupon.per_customer_limit) {
                    return NextResponse.json({ valid: false, error: "per_customer_limit_reached" });
                }
            }
        }

        // Check first order only
        if (coupon.first_order_only && customerEmail) {
            const ordersRes = await fetch(
                `${supabaseUrl}/rest/v1/orders?customer_email=eq.${encodeURIComponent(customerEmail)}&select=id&limit=1`,
                { headers }
            );
            if (ordersRes.ok) {
                const orders = await ordersRes.json();
                if (orders.length > 0) {
                    return NextResponse.json({ valid: false, error: "first_order_only" });
                }
            }
        }

        // Check product/category targeting
        if (coupon.applies_to === "specific_products" && coupon.product_ids?.length > 0 && cartItems) {
            const cartProductIds = cartItems.map((item: { id: string }) => item.id);
            const hasEligible = cartProductIds.some((pid: string) => coupon.product_ids.includes(pid));
            if (!hasEligible) {
                return NextResponse.json({ valid: false, error: "no_eligible_products" });
            }
        }

        if (coupon.applies_to === "specific_categories" && coupon.category_ids?.length > 0 && cartItems) {
            // Need to fetch product categories
            const productIds = cartItems.map((item: { id: string }) => item.id).join(",");
            const prodsRes = await fetch(
                `${supabaseUrl}/rest/v1/products?id=in.(${productIds})&select=id,category`,
                { headers }
            );
            if (prodsRes.ok) {
                const prods = await prodsRes.json();
                const hasEligible = prods.some((p: { category: string }) => coupon.category_ids.includes(p.category));
                if (!hasEligible) {
                    return NextResponse.json({ valid: false, error: "no_eligible_categories" });
                }
            }
        }

        return NextResponse.json({
            valid: true,
            coupon: {
                id: coupon.id,
                code: coupon.code,
                discount_type: coupon.discount_type,
                discount_value: parseFloat(coupon.discount_value),
                max_discount_amount: coupon.max_discount_amount ? parseFloat(coupon.max_discount_amount) : null,
                min_order_amount: coupon.min_order_amount ? parseFloat(coupon.min_order_amount) : null,
                applies_to: coupon.applies_to,
                product_ids: coupon.product_ids,
                category_ids: coupon.category_ids,
                first_order_only: coupon.first_order_only,
            },
        });
    } catch {
        return NextResponse.json(
            { valid: false, error: "Server error" },
            { status: 500 }
        );
    }
}
