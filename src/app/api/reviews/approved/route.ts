import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/reviews/approved
 * Public endpoint: returns approved reviews for homepage carousel.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get("limit") || "20");

        const { data: reviews, error } = await supabaseAdmin
            .from("reviews")
            .select(`
                id, customer_name, rating, text, image_urls, language,
                verified_purchase, approved_at, created_at,
                product:products(name, slug)
            `)
            .eq("is_approved", true)
            .order("approved_at", { ascending: false })
            .limit(limit);

        if (error) throw error;

        return NextResponse.json({ reviews: reviews || [] }, {
            headers: {
                "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
            },
        });
    } catch (err) {
        console.error("[Approved Reviews]", err);
        return NextResponse.json({ reviews: [] }, { status: 500 });
    }
}
