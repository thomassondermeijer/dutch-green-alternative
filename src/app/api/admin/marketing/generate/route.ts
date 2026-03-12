import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Thin invoker: creates placeholder campaign, fires edge function, returns immediately.
// Frontend subscribes to Realtime for status updates.

export async function POST(req: NextRequest) {
    try {
        const { articleId } = await req.json();
        if (!articleId) {
            return NextResponse.json({ error: "articleId required" }, { status: 400 });
        }

        // Create placeholder campaign
        const { data: campaign, error } = await supabaseAdmin.from("marketing_campaigns").insert({
            subject_de: "Generating...", subject_nl: "Generating...", subject_en: "Generating...",
            status: "generating",
            article_id: articleId,
            generation_log: { started_at: new Date().toISOString() },
        }).select("id").single();

        if (error) throw error;

        // Fire edge function (don't await)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        fetch(`${supabaseUrl}/functions/v1/marketing-generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({ campaignId: campaign.id, articleId }),
        }).catch(err => console.error("[Marketing] Edge function invoke failed:", err));

        return NextResponse.json({ success: true, campaignId: campaign.id });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to start generation" },
            { status: 500 }
        );
    }
}
