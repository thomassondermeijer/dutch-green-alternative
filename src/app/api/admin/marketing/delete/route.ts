import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const { campaignId } = await req.json();
        if (!campaignId) {
            return NextResponse.json({ error: "campaignId required" }, { status: 400 });
        }

        // Only allow deleting drafts
        const { data: campaign } = await supabaseAdmin
            .from("marketing_campaigns")
            .select("status, image_url")
            .eq("id", campaignId)
            .single();

        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        if (campaign.status !== "draft" && campaign.status !== "generating") {
            return NextResponse.json({ error: "Only draft/generating campaigns can be deleted" }, { status: 400 });
        }

        // Delete associated image from storage if exists
        if (campaign.image_url?.includes("/marketing/")) {
            const path = campaign.image_url.split("/DGA/")[1];
            if (path) {
                await supabaseAdmin.storage.from("DGA").remove([path]);
            }
        }

        const { error } = await supabaseAdmin
            .from("marketing_campaigns")
            .delete()
            .eq("id", campaignId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Delete failed" },
            { status: 500 }
        );
    }
}
