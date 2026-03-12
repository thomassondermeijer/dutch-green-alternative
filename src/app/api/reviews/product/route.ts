import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/reviews/product?product_id=X
 * Public endpoint: returns approved reviews for a specific product.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const productId = searchParams.get("product_id");

        if (!productId) {
            return NextResponse.json({ error: "product_id required" }, { status: 400 });
        }

        const { data: reviews, error } = await supabaseAdmin
            .from("reviews")
            .select("id, customer_name, rating, text, image_urls, verified_purchase, created_at")
            .eq("product_id", productId)
            .eq("is_approved", true)
            .order("created_at", { ascending: false });

        if (error) throw error;

        // Calculate average rating
        const ratings = (reviews || []).map(r => r.rating);
        const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

        return NextResponse.json({
            reviews: reviews || [],
            averageRating: Math.round(avgRating * 10) / 10,
            totalCount: ratings.length,
        }, {
            headers: {
                "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
            },
        });
    } catch (err) {
        console.error("[Product Reviews]", err);
        return NextResponse.json({ reviews: [], averageRating: 0, totalCount: 0 }, { status: 500 });
    }
}
