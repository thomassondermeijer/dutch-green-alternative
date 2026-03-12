import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Thin invoker — creates a placeholder campaign and calls the Edge Function.
// The Edge Function runs the full pipeline (scrape → Claude → Gemini, ~30-40s)
// within Supabase's 150s timeout. Frontend polls for status: generating → draft.

export async function POST() {
    try {
        // Create placeholder campaign with "generating" status
        const { data: campaign, error } = await supabaseAdmin.from("marketing_campaigns").insert({
            subject_de: "Generating...", subject_nl: "Generating...", subject_en: "Generating...",
            status: "generating",
            generation_log: { started_at: new Date().toISOString() },
        }).select("id").single();

        if (error) throw error;

        // Invoke Edge Function (fire-and-forget — don't await result)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        fetch(`${supabaseUrl}/functions/v1/marketing-generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ campaignId: campaign.id }),
        }).catch(err => {
            console.error("[Marketing] Edge function invoke failed:", err);
        });

        return NextResponse.json({ success: true, campaignId: campaign.id });
    } catch (err) {
        console.error("[Marketing Generate]", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to start generation" },
            { status: 500 }
        );
    }
}
