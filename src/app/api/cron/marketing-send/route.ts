import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/cron/marketing-send
 * Hourly cron: auto-sends approved campaigns where scheduled_for <= now
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const now = new Date().toISOString();

        // Find approved campaigns ready to send
        const { data: campaigns } = await supabaseAdmin
            .from("marketing_campaigns")
            .select("id")
            .eq("status", "approved")
            .not("scheduled_for", "is", null)
            .lte("scheduled_for", now);

        if (!campaigns || campaigns.length === 0) {
            return NextResponse.json({ message: "No campaigns to send", sent: 0 });
        }

        const results = [];

        for (const campaign of campaigns) {
            // Call the send endpoint internally
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || "http://localhost:3000";
            const res = await fetch(`${baseUrl}/api/admin/marketing/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ campaignId: campaign.id }),
            });

            const result = await res.json();
            results.push({ id: campaign.id, ...result });
        }

        return NextResponse.json({ message: `Processed ${results.length} campaigns`, results });
    } catch (err) {
        console.error("[Marketing Cron]", err);
        return NextResponse.json({ error: "Cron failed" }, { status: 500 });
    }
}
