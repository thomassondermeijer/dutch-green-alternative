import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/reviews/list
 * Admin endpoint: returns all reviews for moderation.
 */
export async function GET() {
    try {
        const { data: reviews, error } = await supabaseAdmin
            .from("reviews")
            .select(`
                id, customer_name, customer_email, rating, text, image_urls,
                language, is_approved, verified_purchase, approved_at, created_at,
                coupon_code, order_id,
                products(name),
                orders(order_number)
            `)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return NextResponse.json({ reviews: reviews || [] });
    } catch (err) {
        console.error("[Admin Reviews List]", err);
        return NextResponse.json({ reviews: [] }, { status: 500 });
    }
}
