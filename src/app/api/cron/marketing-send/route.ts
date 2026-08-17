import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/cron/marketing-send
 * 5-minute cron: sends approved/sending campaigns where scheduled_for <= now.
 * Sends 50 emails per run (every 5 minutes) to ensure smooth, high-deliverability sending.
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const now = new Date().toISOString();

        // Find campaigns ready to send:
        // - "approved" with scheduled_for <= now (new campaigns)
        // - "sending" (partially sent, continue in 50-email chunks)
        const { data: campaigns } = await supabaseAdmin
            .from("marketing_campaigns")
            .select("id, status")
            .or(`and(status.eq.approved,scheduled_for.lte.${now}),status.eq.sending`)
            .not("scheduled_for", "is", null);

        if (!campaigns || campaigns.length === 0) {
            return NextResponse.json({ message: "No campaigns to send", sent: 0 });
        }

        // Process ONE campaign per cron run
        const campaign = campaigns[0];
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || "http://localhost:3000";
        const res = await fetch(`${baseUrl}/api/admin/marketing/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaignId: campaign.id, maxRecipients: 50 }),
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

