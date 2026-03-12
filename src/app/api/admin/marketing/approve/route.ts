import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/marketing/approve
 * Approve a campaign with smart scheduling.
 * 
 * Coupon is already assigned at generation time (edge function Step 0).
 * This endpoint only handles:
 * - Auto-calculating send date (latest scheduled + 15 days, or tomorrow)
 * - Collision avoidance (same day → +15 days)
 * - Optional manual date override
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { campaignId, scheduledFor, updates } = body;

        if (!campaignId) {
            return NextResponse.json({ error: "campaignId required" }, { status: 400 });
        }

        // ═══ Step 1: Fetch campaign (to get its existing coupon) ═══
        const { data: campaign, error: fetchErr } = await supabaseAdmin
            .from("marketing_campaigns")
            .select("coupon_code, coupon_discount, coupon_reason")
            .eq("id", campaignId)
            .single();

        if (fetchErr || !campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        // ═══ Step 2: Calculate send date ═══
        let sendDate: Date;

        if (scheduledFor) {
            sendDate = new Date(scheduledFor);
        } else {
            // Auto-calculate: find latest scheduled/sent campaign date, add 15 days
            const { data: latestCampaigns } = await supabaseAdmin
                .from("marketing_campaigns")
                .select("scheduled_for, sent_at")
                .or("status.eq.approved,status.eq.sent")
                .not("scheduled_for", "is", null)
                .order("scheduled_for", { ascending: false })
                .limit(1);

            const latestDate = latestCampaigns?.[0]?.scheduled_for || latestCampaigns?.[0]?.sent_at;

            if (latestDate) {
                sendDate = new Date(new Date(latestDate).getTime() + 15 * 86400000);
            } else {
                // No previous campaigns — schedule for tomorrow 08:00 UTC
                sendDate = new Date();
                sendDate.setDate(sendDate.getDate() + 1);
                sendDate.setUTCHours(8, 0, 0, 0);
            }
        }

        // ═══ Step 3: Collision check ═══
        const dayStart = new Date(sendDate);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayEnd = new Date(sendDate);
        dayEnd.setUTCHours(23, 59, 59, 999);

        const { data: sameDay } = await supabaseAdmin
            .from("marketing_campaigns")
            .select("id")
            .neq("id", campaignId)
            .or("status.eq.approved,status.eq.sent")
            .gte("scheduled_for", dayStart.toISOString())
            .lte("scheduled_for", dayEnd.toISOString());

        if (sameDay && sameDay.length > 0) {
            sendDate = new Date(sendDate.getTime() + 15 * 86400000);
        }

        // Set time to 08:00 UTC if not explicitly provided
        if (!scheduledFor) {
            sendDate.setUTCHours(8, 0, 0, 0);
        }

        // ═══ Step 4: Update campaign (keep existing coupon from generation) ═══
        const updateData: Record<string, unknown> = {
            status: "approved",
            scheduled_for: sendDate.toISOString(),
            updated_at: new Date().toISOString(),
        };

        // Allow editing subject/body before approval
        if (updates) {
            if (updates.subject_de) updateData.subject_de = updates.subject_de;
            if (updates.subject_nl) updateData.subject_nl = updates.subject_nl;
            if (updates.subject_en) updateData.subject_en = updates.subject_en;
            if (updates.body_html_de) updateData.body_html_de = updates.body_html_de;
            if (updates.body_html_nl) updateData.body_html_nl = updates.body_html_nl;
            if (updates.body_html_en) updateData.body_html_en = updates.body_html_en;
        }

        const { error } = await supabaseAdmin
            .from("marketing_campaigns")
            .update(updateData)
            .eq("id", campaignId)
            .eq("status", "draft"); // Can only approve drafts

        if (error) throw error;

        return NextResponse.json({
            success: true,
            scheduled_for: sendDate.toISOString(),
            coupon_code: campaign.coupon_code,
            coupon_discount: campaign.coupon_discount,
            coupon_reason: campaign.coupon_reason,
        });
    } catch (err) {
        console.error("[Marketing Approve]", err);
        return NextResponse.json({ error: "Approval failed" }, { status: 500 });
    }
}
