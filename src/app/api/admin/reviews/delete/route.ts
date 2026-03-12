import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * DELETE /api/admin/reviews/delete
 * Permanently deletes a review and its uploaded images.
 */
export async function DELETE(req: NextRequest) {
    try {
        const { reviewId } = await req.json();
        if (!reviewId) {
            return NextResponse.json({ error: "reviewId required" }, { status: 400 });
        }

        // Fetch review to get image URLs for cleanup
        const { data: review } = await supabaseAdmin
            .from("reviews")
            .select("image_urls")
            .eq("id", reviewId)
            .single();

        // Delete images from storage
        if (review?.image_urls?.length) {
            const paths = review.image_urls.map((url: string) => {
                const match = url.match(/\/DGA\/(.+)$/);
                return match ? match[1] : null;
            }).filter(Boolean);
            if (paths.length > 0) {
                await supabaseAdmin.storage.from("DGA").remove(paths);
            }
        }

        // Delete the review
        const { error } = await supabaseAdmin.from("reviews").delete().eq("id", reviewId);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[Review Delete]", err);
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
