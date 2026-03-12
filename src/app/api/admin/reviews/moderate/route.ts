import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/resend/client";
import { buildReviewRewardEmail } from "@/lib/resend/templates/review-reward";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateCouponCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "REVIEW-";
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

/**
 * POST /api/admin/reviews/moderate
 * Approve or reject a review. On approve: create 40% coupon + send reward email.
 */
export async function POST(req: NextRequest) {
    try {
        const { reviewId, action } = await req.json();

        if (!reviewId || !["approve", "reject"].includes(action)) {
            return NextResponse.json({ error: "reviewId and action (approve/reject) required" }, { status: 400 });
        }

        // Fetch review
        const { data: review, error: fetchErr } = await supabaseAdmin
            .from("reviews")
            .select("*, product:products(name)")
            .eq("id", reviewId)
            .single();

        if (fetchErr || !review) {
            return NextResponse.json({ error: "Review not found" }, { status: 404 });
        }

        if (action === "reject") {
            await supabaseAdmin.from("reviews").update({ is_approved: false }).eq("id", reviewId);
            return NextResponse.json({ success: true, action: "rejected" });
        }

        // === APPROVE ===
        // Generate unique coupon
        let couponCode = generateCouponCode();
        let attempts = 0;
        while (attempts < 5) {
            const { data: exists } = await supabaseAdmin.from("coupons").select("id").eq("code", couponCode).maybeSingle();
            if (!exists) break;
            couponCode = generateCouponCode();
            attempts++;
        }

        // Create coupon: 40% off, max €400, single use, 90-day expiry
        const { error: couponErr } = await supabaseAdmin.from("coupons").insert({
            code: couponCode,
            discount_type: "percentage",
            discount_value: 40,
            max_discount_amount: 400,
            is_active: true,
            valid_from: new Date().toISOString(),
            valid_until: new Date(Date.now() + 90 * 86400000).toISOString(),
            usage_limit: 1,
            usage_count: 0,
            per_customer_limit: 1,
            description: `Review reward for ${review.customer_name} (${review.customer_email})`,
        });

        if (couponErr) {
            console.error("[Review Moderate] Coupon creation failed:", couponErr);
            return NextResponse.json({ error: "Failed to create coupon" }, { status: 500 });
        }

        // Update review
        await supabaseAdmin.from("reviews").update({
            is_approved: true,
            approved_at: new Date().toISOString(),
            coupon_code: couponCode,
        }).eq("id", reviewId);

        // Determine customer language from order or default
        let locale = review.language || "de";
        if (review.order_id) {
            const { data: order } = await supabaseAdmin
                .from("orders")
                .select("language")
                .eq("id", review.order_id)
                .single();
            if (order?.language) locale = order.language;
        }

        // Send reward email
        const productName = review.product?.name || "unsere Produkte";
        const html = buildReviewRewardEmail({
            customerName: review.customer_name,
            couponCode,
            productName,
            locale,
        });

        const subjectMap: Record<string, string> = {
            de: "🎉 Ihr 40% Dankeschön-Gutschein!",
            nl: "🎉 Uw 40% bedankingsvoucher!",
            en: "🎉 Your 40% thank-you coupon!",
        };

        await sendEmail({
            to: review.customer_email,
            subject: subjectMap[locale] || subjectMap.de,
            html,
        });

        return NextResponse.json({ success: true, action: "approved", couponCode });
    } catch (err) {
        console.error("[Review Moderate]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
