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
 * Convert Supabase storage URLs to domain-proxied URLs for better email deliverability.
 */
const SUPABASE_STORAGE_PREFIX = "https://xburabmzlolrnywcyxwz.supabase.co/storage/v1/object/public/DGA/";
const DOMAIN_ASSET_PREFIX = "https://dutchgreenalternative.nl/email-assets/";

function proxyImageUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    if (url.startsWith(SUPABASE_STORAGE_PREFIX)) {
        return url.replace(SUPABASE_STORAGE_PREFIX, DOMAIN_ASSET_PREFIX);
    }
    return url;
}

const BATCH_SIZE = 50;  // smaller batches for reliability
const BATCH_DELAY = 2000;
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

type Recipient = { email: string; first_name: string | null; language_pref: string; total_spent?: number };

async function getFilteredRecipients(filter: AudienceFilter): Promise<Recipient[]> {
    let rawRecipients: Recipient[] = [];
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
        rawRecipients = (fallback || []) as Recipient[];
    } else {
        rawRecipients = (data || []) as Recipient[];
    }

    // Deduplicate by lowercased email address
    const uniqueMap = new Map<string, Recipient>();
    for (const r of rawRecipients) {
        if (r.email) {
            const key = r.email.trim().toLowerCase();
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, r);
            }
        }
    }
    return Array.from(uniqueMap.values());
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

/**
 * Get emails already processed for this campaign.
 * Uses paginated fetching to avoid Supabase's default 1,000-row limit.
 * Excludes recipients that are either sent OR have failed 3+ times to avoid infinite retry loops.
 */
async function getCompletedRecipients(campaignId: string): Promise<{ sent: Set<string>; completed: Set<string> }> {
    const sent = new Set<string>();
    const failCounts: Record<string, number> = {};
    const PAGE_SIZE = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabaseAdmin
            .from("email_log")
            .select("recipient, status")
            .eq("campaign_id", campaignId)
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error || !data || data.length === 0) {
            hasMore = false;
            break;
        }

        data.forEach((d) => {
            const email = d.recipient.toLowerCase();
            if (d.status === "sent") {
                sent.add(email);
            } else if (d.status === "failed") {
                failCounts[email] = (failCounts[email] || 0) + 1;
            }
        });

        if (data.length < PAGE_SIZE) {
            hasMore = false;
        } else {
            page++;
        }
    }

    const completed = new Set<string>(sent);
    Object.entries(failCounts).forEach(([email, count]) => {
        if (count >= 3) {
            completed.add(email);
        }
    });

    return { sent, completed };
}

// POST: send campaign using Resend Batch API (throttled to 10 emails per run for cron)
export async function POST(req: NextRequest) {
    try {
        const { campaignId, testEmail, testLocale, maxRecipients = 10 } = await req.json();
        if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

        const { data: campaign, error: campErr } = await supabaseAdmin
            .from("marketing_campaigns").select("*").eq("id", campaignId).single();

        if (campErr || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        if (!testEmail && !["approved", "sending"].includes(campaign.status)) {
            return NextResponse.json({ error: "Campaign must be approved first" }, { status: 400 });
        }

        const product = PRODUCTS[campaign.recommended_product_slug] || { name: "CBD Oil", price: 29.95 };

        // Fetch coupon expiry for the discount banner
        let couponValidUntil: string | undefined;
        if (campaign.coupon_code) {
            const { data: couponData } = await supabaseAdmin.from("coupons").select("valid_until").eq("code", campaign.coupon_code).maybeSingle();
            couponValidUntil = couponData?.valid_until || undefined;
        }

        let recipientsToProcess: Recipient[] = [];
        let remainingCount = 0;
        let totalSentCount = 0;

        if (testEmail) {
            recipientsToProcess = [{ email: testEmail, first_name: "Test", language_pref: testLocale || "de" }];
        } else {
            const allRecipients = await getFilteredRecipients((campaign.audience_filter || {}) as AudienceFilter);
            const { sent, completed } = await getCompletedRecipients(campaignId);
            
            totalSentCount = sent.size;
            const remainingRecipients = allRecipients.filter((r) => !completed.has(r.email.toLowerCase()));

            if (remainingRecipients.length === 0) {
                // All done! Update campaign status to sent
                await supabaseAdmin.from("marketing_campaigns").update({
                    status: "sent",
                    sent_at: campaign.sent_at || new Date().toISOString(),
                    sent_count: totalSentCount,
                }).eq("id", campaignId);

                return NextResponse.json({
                    success: true,
                    sent: 0,
                    failed: 0,
                    totalSent: totalSentCount,
                    remaining: 0,
                    message: "All recipients have been processed!",
                });
            }

            // Cap the current run to maxRecipients (default 10 for 5-min cron runs)
            recipientsToProcess = remainingRecipients.slice(0, maxRecipients);
            remainingCount = remainingRecipients.length - recipientsToProcess.length;

            // Set status to "sending"
            await supabaseAdmin.from("marketing_campaigns").update({ status: "sending" }).eq("id", campaignId);
        }

        // 1. Build email payloads
        type PreparedEmail = { recipient: Recipient; locale: string; subject: string; batchItem: BatchEmailItem };
        const prepared: PreparedEmail[] = recipientsToProcess.map((recipient) => {
            const locale = recipient.language_pref || "de";
            const subject = (campaign[`subject_${locale}`] as string) || campaign.subject_de;
            let bodyHtml = (campaign[`body_html_${locale}`] as string) || campaign.body_html_de;

            const firstName = recipient.first_name || NAME_FALLBACK[locale] || NAME_FALLBACK.de;
            bodyHtml = bodyHtml.replace(/\{FIRST_NAME\}/g, firstName);
            bodyHtml = bodyHtml.replace(/\{DISCOUNT\}/g, String(campaign.coupon_discount));

            const html = buildMarketingNewsletterEmail({
                subject, bodyHtml,
                imageUrl: proxyImageUrl(campaign.image_url),
                productName: product.name,
                productSlug: campaign.recommended_product_slug,
                productPrice: product.price,
                couponCode: campaign.coupon_code,
                couponDiscount: campaign.coupon_discount,
                couponReason: campaign.coupon_reason || "",
                couponValidUntil,
                locale,
            });

            return {
                recipient, locale, subject,
                batchItem: { to: recipient.email, subject, html },
            };
        });

        // 2. Send in batches
        let sentCount = 0;
        let failedCount = 0;

        for (let i = 0; i < prepared.length; i += BATCH_SIZE) {
            const batchSlice = prepared.slice(i, i + BATCH_SIZE);
            const batchItems = batchSlice.map((p) => p.batchItem);

            const results = await sendBatchEmails(batchItems);

            // 3. Log each email result
            const logEntries = batchSlice.map((p, idx) => {
                const resItem = results[idx];
                return {
                    recipient: p.recipient.email,
                    template: "marketing-newsletter",
                    subject: p.subject,
                    language: p.locale,
                    status: resItem?.success ? "sent" : "failed",
                    resend_id: resItem?.id || null,
                    campaign_id: campaignId,
                    metadata: {
                        coupon: campaign.coupon_code,
                        product: campaign.recommended_product_slug,
                        error: resItem?.error ? (typeof resItem.error === 'object' ? JSON.stringify(resItem.error) : String(resItem.error)) : undefined,
                    },
                };
            });

            await supabaseAdmin.from("email_log").insert(logEntries);

            results.forEach((r) => {
                if (r.success) sentCount++; else failedCount++;
            });

            if (i + BATCH_SIZE < prepared.length) {
                await new Promise((r) => setTimeout(r, BATCH_DELAY));
            }
        }

        if (!testEmail) {
            // Re-calculate sent and remaining
            const { sent, completed } = await getCompletedRecipients(campaignId);
            const allRecipients = await getFilteredRecipients((campaign.audience_filter || {}) as AudienceFilter);
            const unsent = allRecipients.filter((r) => !completed.has(r.email.toLowerCase()));
            const updatedTotalSent = sent.size;

            if (unsent.length === 0) {
                await supabaseAdmin.from("marketing_campaigns").update({
                    status: "sent",
                    sent_at: new Date().toISOString(),
                    sent_count: updatedTotalSent,
                }).eq("id", campaignId);
            } else {
                await supabaseAdmin.from("marketing_campaigns").update({
                    status: "sending",
                    sent_count: updatedTotalSent,
                }).eq("id", campaignId);
            }

            return NextResponse.json({
                success: true,
                sent: sentCount,
                failed: failedCount,
                totalSent: updatedTotalSent,
                remaining: unsent.length,
                message: unsent.length > 0
                    ? `Sent ${sentCount} emails (${updatedTotalSent} total sent). ${unsent.length} remaining.`
                    : `All ${updatedTotalSent} emails sent!`,
            });
        }

        return NextResponse.json({ success: true, sent: sentCount, failed: failedCount });
    } catch (err) {
        console.error("[Marketing Send]", err);
        return NextResponse.json({ error: "Send failed" }, { status: 500 });
    }
}

