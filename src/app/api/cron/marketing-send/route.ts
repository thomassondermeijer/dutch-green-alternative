import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/cron/marketing-send
 * Hourly cron: sends approved/sending campaigns where scheduled_for <= now.
 * 
 * DAILY GUARD: Checks email_log to see if marketing emails were already sent today.
 * If yes, skips to avoid exceeding Resend's 100/day free plan limit.
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const now = new Date().toISOString();

        // ── Daily guard: check if we already sent marketing emails today ──
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);

        const { count: sentToday } = await supabaseAdmin
            .from("email_log")
            .select("id", { count: "exact", head: true })
            .eq("status", "sent")
            .gte("sent_at", todayStart.toISOString());

        const DAILY_LIMIT = 90;
        if ((sentToday || 0) >= DAILY_LIMIT) {
            console.log(`[Marketing Cron] Daily limit reached (${sentToday}/${DAILY_LIMIT}). Skipping.`);
            return NextResponse.json({
                message: `Daily limit already reached (${sentToday} sent today). Will retry tomorrow.`,
                sent: 0,
            });
        }

        // Find campaigns ready to send:
        // - "approved" with scheduled_for <= now (new campaigns)
        // - "sending" (partially sent, continue daily)
        const { data: campaigns } = await supabaseAdmin
            .from("marketing_campaigns")
            .select("id, status")
            .or(`and(status.eq.approved,scheduled_for.lte.${now}),status.eq.sending`)
            .not("scheduled_for", "is", null);

        if (!campaigns || campaigns.length === 0) {
            return NextResponse.json({ message: "No campaigns to send", sent: 0 });
        }

        // Only process ONE campaign per cron run to stay within limits
        const campaign = campaigns[0];
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || "http://localhost:3000";
        const res = await fetch(`${baseUrl}/api/admin/marketing/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaignId: campaign.id }),
        });

        const result = await res.json();
        console.log(`[Marketing Cron] Campaign ${campaign.id}: sent=${result.sent}, remaining=${result.remaining}`);

        return NextResponse.json({
            message: `Processed campaign ${campaign.id}`,
            result,
        });
    } catch (err) {
        console.error("[Marketing Cron]", err);
        return NextResponse.json({ error: "Cron failed" }, { status: 500 });
    }
}
