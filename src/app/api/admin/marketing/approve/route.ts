import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Same seasonal coupon logic as edge function, but accepts a target date
function getSeasonalCouponForDate(targetDate: Date): { code: string; discount: number; reason: string } {
    const year = targetDate.getFullYear();
    const yr = year.toString().slice(-2);
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const easterMonth = Math.floor((h + l - 7 * m + 114) / 31);
    const easterDay = ((h + l - 7 * m + 114) % 31) + 1;
    const easter = new Date(year, easterMonth - 1, easterDay);

    const events = [
        { date: new Date(year, 0, 1), code: "NEWYEAR" + yr, discount: 12, reason: "New Year" },
        { date: new Date(year, 1, 14), code: "VALENTINE" + yr, discount: 10, reason: "Valentine's Day" },
        { date: new Date(year, 2, 20), code: "SLEEPDAY" + yr, discount: 10, reason: "World Sleep Day" },
        { date: new Date(year, 2, 21), code: "SPRING" + yr, discount: 10, reason: "Spring Equinox" },
        { date: new Date(year, 3, 7), code: "HEALTHDAY" + yr, discount: 10, reason: "World Health Day" },
        { date: easter, code: "OSTERN" + yr, discount: 12, reason: "Easter" },
        { date: new Date(year, 3, 27), code: "KONINGSDAG" + yr, discount: 10, reason: "King's Day" },
        { date: new Date(year, 4, 11), code: "MUTTERTAG" + yr, discount: 10, reason: "Mother's Day" },
        { date: new Date(year, 5, 15), code: "VATERTAG" + yr, discount: 10, reason: "Father's Day" },
        { date: new Date(year, 5, 21), code: "SUMMER" + yr, discount: 10, reason: "Summer Solstice" },
        { date: new Date(year, 8, 21), code: "WELLNESS" + yr, discount: 10, reason: "World Gratitude Day" },
        { date: new Date(year, 8, 23), code: "HERBST" + yr, discount: 10, reason: "Autumn Equinox" },
        { date: new Date(year, 9, 10), code: "MENTALHEALTH" + yr, discount: 10, reason: "World Mental Health Day" },
        { date: new Date(year, 10, 28), code: "BLACKFRIDAY" + yr, discount: 20, reason: "Black Friday" },
        { date: new Date(year, 11, 21), code: "WINTER" + yr, discount: 10, reason: "Winter Solstice" },
        { date: new Date(year, 11, 25), code: "KERST" + yr, discount: 15, reason: "Christmas" },
        { date: new Date(year + 1, 0, 1), code: "NEWYEAR" + (Number(yr) + 1), discount: 12, reason: "New Year" },
    ];
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Find the next event on or after the target date
    return events.find(e => e.date.getTime() >= targetDate.getTime() - 86400000) || events[0];
}

/**
 * POST /api/admin/marketing/approve
 * Approve a campaign with smart scheduling and dynamic coupon assignment.
 * 
 * - Auto-calculates send date: latest scheduled campaign + 15 days, or tomorrow
 * - Picks coupon based on the scheduled date (not today)
 * - Creates coupon in DB if it doesn't exist
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { campaignId, scheduledFor, updates } = body;

        if (!campaignId) {
            return NextResponse.json({ error: "campaignId required" }, { status: 400 });
        }

        // ═══ Step 1: Calculate send date ═══
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

        // ═══ Step 2: Collision check — if another campaign is on the same day, push +15 days ═══
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
            // Push 15 days later
            sendDate = new Date(sendDate.getTime() + 15 * 86400000);
        }

        // Set time to 08:00 UTC if not explicitly provided
        if (!scheduledFor) {
            sendDate.setUTCHours(8, 0, 0, 0);
        }

        // ═══ Step 3: Pick coupon based on the scheduled send date ═══
        const coupon = getSeasonalCouponForDate(sendDate);

        // Create coupon in DB if it doesn't exist
        const { data: existingCoupon } = await supabaseAdmin
            .from("coupons")
            .select("id")
            .eq("code", coupon.code)
            .maybeSingle();

        if (!existingCoupon) {
            await supabaseAdmin.from("coupons").insert({
                code: coupon.code,
                discount_type: "percentage",
                discount_value: coupon.discount,
                is_active: true,
                valid_from: new Date(sendDate.getTime() - 2 * 86400000).toISOString(), // valid 2 days before send
                valid_until: new Date(sendDate.getTime() + 10 * 86400000).toISOString(), // valid 10 days after send
                usage_limit: 999,
                usage_count: 0,
                description: `Auto-generated for ${coupon.reason} newsletter campaign`,
            });
        }

        // ═══ Step 4: Update campaign ═══
        const updateData: Record<string, unknown> = {
            status: "approved",
            scheduled_for: sendDate.toISOString(),
            coupon_code: coupon.code,
            coupon_discount: coupon.discount,
            coupon_reason: coupon.reason,
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
            coupon_code: coupon.code,
            coupon_discount: coupon.discount,
            coupon_reason: coupon.reason,
        });
    } catch (err) {
        console.error("[Marketing Approve]", err);
        return NextResponse.json({ error: "Approval failed" }, { status: 500 });
    }
}
