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
                coupon_code, order_id, product_id,
                orders(order_number)
            `)
            .order("created_at", { ascending: false });

        if (error) throw error;

        // Enrich with product name from translations if product_id exists
        let productMap: Record<string, string> = {};
        const productIds = (reviews || []).map(r => r.product_id).filter(Boolean);
        if (productIds.length > 0) {
            const { data: products } = await supabaseAdmin
                .from("products")
                .select("id, translations")
                .in("id", productIds);
            if (products) {
                for (const p of products) {
                    const t = p.translations as Record<string, { name?: string }>;
                    productMap[p.id] = t?.de?.name || t?.en?.name || t?.nl?.name || "Unknown";
                }
            }
        }

        const enriched = (reviews || []).map(r => ({
            ...r,
            product_name: r.product_id ? (productMap[r.product_id] || null) : null,
        }));

        return NextResponse.json({ reviews: enriched });
    } catch (err) {
        console.error("[Admin Reviews List]", err);
        return NextResponse.json({ reviews: [] }, { status: 500 });
    }
}
