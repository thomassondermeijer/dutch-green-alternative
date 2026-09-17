import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/auth/admin";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/marketing/generate
 *
 * Starts newsletter generation for an article, or retries it for an existing
 * campaign. Creates (or resets) the campaign row, invokes the
 * `marketing-generate` Edge Function, and returns once that invocation has
 * been *accepted* — the pipeline itself runs for minutes on Supabase and the
 * UI follows it over Realtime.
 *
 * The invoke is awaited. It used to be fire-and-forget, and on Netlify the
 * request was frozen with the function before it ever reached Supabase: the
 * campaign row was created, nothing else happened, and the UI showed
 * "Generating…" indefinitely. The Edge Function now answers 202 in well under
 * a second, so waiting for it costs nothing.
 *
 * Body: { articleId } to start, or { campaignId } to retry.
 */
export async function POST(req: NextRequest) {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let campaignId = "";
    try {
        const body = await req.json();
        let articleId: string = body.articleId || "";

        if (body.campaignId) {
            // Retry: reuse the row so the campaign keeps its identity and history.
            const { data: existing } = await supabaseAdmin
                .from("marketing_campaigns")
                .select("id, status, article_id")
                .eq("id", body.campaignId)
                .maybeSingle();

            if (!existing) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
            if (!["failed", "generating", "draft"].includes(existing.status)) {
                return NextResponse.json({ error: `Cannot regenerate a ${existing.status} campaign` }, { status: 400 });
            }
            if (!existing.article_id) {
                return NextResponse.json({ error: "Campaign has no source article to regenerate from" }, { status: 400 });
            }

            campaignId = existing.id;
            articleId = existing.article_id;

            await supabaseAdmin.from("marketing_campaigns").update({
                status: "generating",
                subject_de: "Generating...", subject_nl: "Generating...", subject_en: "Generating...",
                generation_log: { started_at: new Date().toISOString(), retry_of: existing.status },
            }).eq("id", campaignId);
        } else {
            if (!articleId) {
                return NextResponse.json({ error: "articleId required" }, { status: 400 });
            }

            const { data: campaign, error } = await supabaseAdmin.from("marketing_campaigns").insert({
                subject_de: "Generating...", subject_nl: "Generating...", subject_en: "Generating...",
                status: "generating",
                article_id: articleId,
                generation_log: { started_at: new Date().toISOString() },
            }).select("id").single();

            if (error || !campaign) throw error || new Error("Could not create campaign");
            campaignId = campaign.id;
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        const res = await fetch(`${supabaseUrl}/functions/v1/marketing-generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({ campaignId, articleId }),
            signal: AbortSignal.timeout(15_000),
        });

        if (!res.ok) {
            const detail = await res.json().catch(() => ({}));
            const reason = detail.error || `Edge Function returned ${res.status}`;
            await markFailed(campaignId, reason);
            return NextResponse.json({ error: reason, campaignId }, { status: 502 });
        }

        return NextResponse.json({ success: true, campaignId });
    } catch (err) {
        const reason = err instanceof Error ? err.message : "Failed to start generation";
        // Never leave a row stuck in "generating" with nothing behind it.
        if (campaignId) await markFailed(campaignId, `Could not start generation: ${reason}`);
        return NextResponse.json({ error: reason, campaignId: campaignId || undefined }, { status: 500 });
    }
}

async function markFailed(campaignId: string, reason: string) {
    await supabaseAdmin.from("marketing_campaigns").update({
        status: "failed",
        generation_log: { step: "FAILED", error: reason, failed_at: new Date().toISOString() },
    }).eq("id", campaignId);
}
