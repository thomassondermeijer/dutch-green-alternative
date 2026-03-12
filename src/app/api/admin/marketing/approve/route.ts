import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/marketing/approve
 * Approve a campaign and optionally schedule it.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { campaignId, scheduledFor, updates } = body;

        if (!campaignId) {
            return NextResponse.json({ error: "campaignId required" }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {
            status: "approved",
            updated_at: new Date().toISOString(),
        };

        if (scheduledFor) {
            updateData.scheduled_for = scheduledFor;
        }

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

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[Marketing Approve]", err);
        return NextResponse.json({ error: "Approval failed" }, { status: 500 });
    }
}
