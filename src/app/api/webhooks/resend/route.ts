import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Resend webhook signing secret (optional, for verification)
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || "";

/**
 * POST /api/webhooks/resend
 * Receives Resend webhook events: delivered, opened, clicked, bounced, complained
 * Docs: https://resend.com/docs/dashboard/webhooks/introduction
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { type, data } = body;

        // Map Resend event types to our internal types
        const eventMap: Record<string, string> = {
            "email.delivered": "delivered",
            "email.opened": "opened",
            "email.clicked": "clicked",
            "email.bounced": "bounced",
            "email.complained": "complained",
        };

        const eventType = eventMap[type];
        if (!eventType) {
            // Not a tracked event type, acknowledge anyway
            return NextResponse.json({ ok: true, skipped: type });
        }

        const emailId = data?.email_id;
        if (!emailId) {
            return NextResponse.json({ ok: true, skipped: "no email_id" });
        }

        // Auto-suppress bounced/complained emails (ALL emails, not just campaigns)
        if (eventType === "bounced" || eventType === "complained") {
            const recipientEmail = data?.to?.[0] || data?.email;
            if (recipientEmail) {
                await supabaseAdmin.from("email_suppression").upsert(
                    {
                        email: recipientEmail.toLowerCase(),
                        reason: eventType,
                        source: "webhook",
                    },
                    { onConflict: "email,reason" }
                );
                console.log(`[Resend Webhook] Auto-suppressed ${recipientEmail} (${eventType})`);
            }
        }

        // Look up the email_log entry by resend_id for campaign stats
        const { data: logEntry } = await supabaseAdmin
            .from("email_log")
            .select("id, campaign_id")
            .eq("resend_id", emailId)
            .maybeSingle();

        if (!logEntry?.campaign_id) {
            // Not a marketing email — suppression already handled above
            return NextResponse.json({ ok: true, suppressed: eventType === "bounced" || eventType === "complained" });
        }

        // Insert event
        await supabaseAdmin.from("marketing_email_events").insert({
            campaign_id: logEntry.campaign_id,
            email_log_id: logEntry.id,
            resend_id: emailId,
            event_type: eventType,
            event_data: {
                click_url: data?.click?.url || null,
                ip: data?.click?.ipAddress || data?.open?.ipAddress || null,
                user_agent: data?.click?.userAgent || data?.open?.userAgent || null,
                bounce_type: data?.bounce?.type || null,
                timestamp: data?.created_at || new Date().toISOString(),
            },
        });

        // Update campaign stats (aggregate counts)
        const { data: events } = await supabaseAdmin
            .from("marketing_email_events")
            .select("event_type")
            .eq("campaign_id", logEntry.campaign_id);

        if (events) {
            const stats: Record<string, number> = {};
            // Count unique resend_ids per event type for accurate unique counts
            const uniqueByType: Record<string, Set<string>> = {};

            for (const e of events) {
                stats[e.event_type] = (stats[e.event_type] || 0) + 1;
            }

            // For opened/clicked, also get unique counts
            const { data: uniqueOpens } = await supabaseAdmin
                .from("marketing_email_events")
                .select("resend_id")
                .eq("campaign_id", logEntry.campaign_id)
                .eq("event_type", "opened");

            const { data: uniqueClicks } = await supabaseAdmin
                .from("marketing_email_events")
                .select("resend_id")
                .eq("campaign_id", logEntry.campaign_id)
                .eq("event_type", "clicked");

            stats.unique_opens = new Set(uniqueOpens?.map(e => e.resend_id)).size;
            stats.unique_clicks = new Set(uniqueClicks?.map(e => e.resend_id)).size;

            await supabaseAdmin.from("marketing_campaigns").update({
                stats,
            }).eq("id", logEntry.campaign_id);
        }

        return NextResponse.json({ ok: true, event: eventType });
    } catch (err) {
        console.error("[Resend Webhook]", err);
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }
}
