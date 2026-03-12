import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/resend/client";
import { buildMarketingNewsletterEmail } from "@/lib/resend/templates/marketing-newsletter";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PRODUCTS: Record<string, { name: string; price: number }> = {
    "cbd-raw-5-5": { name: "RAW CBD Öl 5,5%", price: 29.95 },
    "cbd-raw-11": { name: "RAW CBD Öl 11%", price: 41.95 },
    "cbd-gold-35": { name: "CBD Gold 35%", price: 84.95 },
    "golden-spectrum-35": { name: "Golden Spectrum 35% (CBD+CBG+CBN)", price: 89.95 },
    "cbg-raw-12": { name: "CBG RAW 12%", price: 49.95 },
    "mind-comfort-8": { name: "Mind Comfort", price: 44.95 },
    "good-night-8": { name: "Good Night", price: 44.95 },
    "body-harmony-8": { name: "Body Harmony", price: 44.95 },
};

const BATCH_SIZE = 50;
const BATCH_DELAY = 1000; // 1s between batches

/**
 * POST /api/admin/marketing/send
 * Send an approved campaign to all customers.
 */
export async function POST(req: NextRequest) {
    try {
        const { campaignId, testEmail } = await req.json();

        if (!campaignId) {
            return NextResponse.json({ error: "campaignId required" }, { status: 400 });
        }

        // Fetch campaign
        const { data: campaign, error: campErr } = await supabaseAdmin
            .from("marketing_campaigns")
            .select("*")
            .eq("id", campaignId)
            .single();

        if (campErr || !campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        if (!testEmail && campaign.status !== "approved") {
            return NextResponse.json({ error: "Campaign must be approved first" }, { status: 400 });
        }

        // Update status to sending
        if (!testEmail) {
            await supabaseAdmin
                .from("marketing_campaigns")
                .update({ status: "sending" })
                .eq("id", campaignId);
        }

        const product = PRODUCTS[campaign.recommended_product_slug] || { name: "CBD Oil", price: 29.95 };

        // Get recipients
        let recipients: { email: string; language?: string }[] = [];

        if (testEmail) {
            // Test mode: send to single email
            recipients = [{ email: testEmail, language: "de" }];
        } else {
            // Production: all customers
            const { data: customers } = await supabaseAdmin
                .from("customers")
                .select("email, language")
                .not("email", "is", null)
                .neq("email", "");
            recipients = customers || [];
        }

        let sentCount = 0;
        let failedCount = 0;

        // Send in batches
        for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
            const batch = recipients.slice(i, i + BATCH_SIZE);

            await Promise.allSettled(
                batch.map(async (recipient) => {
                    const locale = recipient.language || "de";
                    const subjectKey = `subject_${locale}` as keyof typeof campaign;
                    const bodyKey = `body_html_${locale}` as keyof typeof campaign;

                    const subject = (campaign[subjectKey] as string) || campaign.subject_de;
                    const bodyHtml = (campaign[bodyKey] as string) || campaign.body_html_de;

                    const html = buildMarketingNewsletterEmail({
                        subject,
                        bodyHtml,
                        imageUrl: campaign.image_url || undefined,
                        productName: product.name,
                        productSlug: campaign.recommended_product_slug,
                        productPrice: product.price,
                        couponCode: campaign.coupon_code,
                        couponDiscount: campaign.coupon_discount,
                        locale,
                    });

                    const result = await sendEmail({
                        to: recipient.email,
                        subject,
                        html,
                    });

                    // Log to email_log
                    await supabaseAdmin.from("email_log").insert({
                        recipient: recipient.email,
                        template: "marketing-newsletter",
                        subject,
                        language: locale,
                        status: result.success ? "sent" : "failed",
                        resend_id: result.id || null,
                        metadata: {
                            campaign_id: campaignId,
                            coupon: campaign.coupon_code,
                            product: campaign.recommended_product_slug,
                        },
                    });

                    if (result.success) sentCount++;
                    else failedCount++;
                })
            );

            // Pause between batches
            if (i + BATCH_SIZE < recipients.length) {
                await new Promise((r) => setTimeout(r, BATCH_DELAY));
            }
        }

        // Update campaign
        if (!testEmail) {
            await supabaseAdmin
                .from("marketing_campaigns")
                .update({
                    status: "sent",
                    sent_at: new Date().toISOString(),
                    sent_count: sentCount,
                    failed_count: failedCount,
                })
                .eq("id", campaignId);
        }

        return NextResponse.json({ success: true, sent: sentCount, failed: failedCount });
    } catch (err) {
        console.error("[Marketing Send]", err);
        return NextResponse.json({ error: "Send failed" }, { status: 500 });
    }
}
