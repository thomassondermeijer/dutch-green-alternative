import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendBatchEmails, type BatchEmailItem } from "@/lib/resend/client";
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

/**
 * Resend Batch API allows up to 100 emails per call.
 * We use 100 per batch with 1.5s delay between batches to stay safe.
 */
const BATCH_SIZE = 100;
const BATCH_DELAY = 1500;
const NAME_FALLBACK: Record<string, string> = { de: "Kunde", nl: "Klant", en: "Customer" };

type AudienceFilter = {
    min_spent?: number;
    max_spent?: number;
    ordered_within_days?: number;
    ordered_before_days?: number;
    min_order_count?: number;
    languages?: string[];
    never_purchased?: boolean;
};

type Recipient = { email: string; first_name: string | null; language_pref: string };

async function getFilteredRecipients(filter: AudienceFilter): Promise<Recipient[]> {
    const { data, error } = await supabaseAdmin.rpc("filter_marketing_recipients", {
        p_min_spent: filter.min_spent ?? null,
        p_max_spent: filter.max_spent ?? null,
        p_ordered_within_days: filter.ordered_within_days ?? null,
        p_ordered_before_days: filter.ordered_before_days ?? null,
        p_min_order_count: filter.min_order_count ?? null,
        p_languages: (filter.languages && filter.languages.length > 0 && filter.languages.length < 3) ? filter.languages : null,
        p_never_purchased: filter.never_purchased ?? false,
    });

    if (error) {
        console.error("[Filter Recipients]", error);
        const { data: fallback } = await supabaseAdmin.from("customers").select("email, first_name, language_pref").not("email", "is", null);
        return (fallback || []) as Recipient[];
    }
    return (data || []) as Recipient[];
}

// PUT: count recipients for a given filter
export async function PUT(req: NextRequest) {
    try {
        const filter = (await req.json()) as AudienceFilter;
        const recipients = await getFilteredRecipients(filter);
        return NextResponse.json({ count: recipients.length });
    } catch {
        return NextResponse.json({ error: "Count failed", count: 0 }, { status: 500 });
    }
}

// POST: send campaign using Resend Batch API
export async function POST(req: NextRequest) {
    try {
        const { campaignId, testEmail } = await req.json();
        if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

        const { data: campaign, error: campErr } = await supabaseAdmin
            .from("marketing_campaigns").select("*").eq("id", campaignId).single();

        if (campErr || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        if (!testEmail && campaign.status !== "approved") return NextResponse.json({ error: "Campaign must be approved first" }, { status: 400 });

        if (!testEmail) {
            await supabaseAdmin.from("marketing_campaigns").update({ status: "sending" }).eq("id", campaignId);
        }

        const product = PRODUCTS[campaign.recommended_product_slug] || { name: "CBD Oil", price: 29.95 };

        let recipients: Recipient[] = [];
        if (testEmail) {
            recipients = [{ email: testEmail, first_name: "Test", language_pref: "de" }];
        } else {
            recipients = await getFilteredRecipients((campaign.audience_filter || {}) as AudienceFilter);
        }

        // 1. Build all email payloads
        type PreparedEmail = { recipient: Recipient; locale: string; subject: string; batchItem: BatchEmailItem };
        const prepared: PreparedEmail[] = recipients.map((recipient) => {
            const locale = recipient.language_pref || "de";
            const subject = (campaign[`subject_${locale}`] as string) || campaign.subject_de;
            let bodyHtml = (campaign[`body_html_${locale}`] as string) || campaign.body_html_de;

            const firstName = recipient.first_name || NAME_FALLBACK[locale] || NAME_FALLBACK.de;
            bodyHtml = bodyHtml.replace(/\{FIRST_NAME\}/g, firstName);
            bodyHtml = bodyHtml.replace(/\{DISCOUNT\}/g, String(campaign.coupon_discount));

            const html = buildMarketingNewsletterEmail({
                subject, bodyHtml,
                imageUrl: campaign.image_url || undefined,
                productName: product.name,
                productSlug: campaign.recommended_product_slug,
                productPrice: product.price,
                couponCode: campaign.coupon_code,
                couponDiscount: campaign.coupon_discount,
                locale,
            });

            return {
                recipient, locale, subject,
                batchItem: { to: recipient.email, subject, html },
            };
        });

        // 2. Send in batches of 100 using Resend Batch API
        let sentCount = 0;
        let failedCount = 0;

        for (let i = 0; i < prepared.length; i += BATCH_SIZE) {
            const batchSlice = prepared.slice(i, i + BATCH_SIZE);
            const batchItems = batchSlice.map((p) => p.batchItem);

            const results = await sendBatchEmails(batchItems);

            // 3. Log each email result
            const logEntries = batchSlice.map((p, idx) => ({
                recipient: p.recipient.email,
                template: "marketing-newsletter",
                subject: p.subject,
                language: p.locale,
                status: results[idx]?.success ? "sent" : "failed",
                resend_id: results[idx]?.id || null,
                campaign_id: campaignId,
                metadata: { coupon: campaign.coupon_code, product: campaign.recommended_product_slug },
            }));

            // Batch insert logs
            await supabaseAdmin.from("email_log").insert(logEntries);

            results.forEach((r) => {
                if (r.success) sentCount++; else failedCount++;
            });

            // Wait between batches to stay within rate limits
            if (i + BATCH_SIZE < prepared.length) {
                await new Promise((r) => setTimeout(r, BATCH_DELAY));
            }
        }

        if (!testEmail) {
            await supabaseAdmin.from("marketing_campaigns").update({
                status: "sent", sent_at: new Date().toISOString(), sent_count: sentCount, failed_count: failedCount,
            }).eq("id", campaignId);
        }

        return NextResponse.json({ success: true, sent: sentCount, failed: failedCount });
    } catch (err) {
        console.error("[Marketing Send]", err);
        return NextResponse.json({ error: "Send failed" }, { status: 500 });
    }
}
