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
const BATCH_DELAY = 1000;

// Name fallback per locale
const NAME_FALLBACK: Record<string, string> = { de: "Kunde", nl: "Klant", en: "Customer" };

type AudienceFilter = {
    min_spent?: number;
    max_spent?: number;
    ordered_within_days?: number;
    ordered_before_days?: number;
    min_order_count?: number;
    languages?: string[];
    has_purchased_product?: string[];
    never_purchased?: boolean;
};

async function getFilteredRecipients(filter: AudienceFilter): Promise<{ email: string; first_name: string | null; language_pref: string }[]> {
    // Build a SQL query dynamically based on filters
    const conditions: string[] = ["c.email IS NOT NULL"];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filter.languages && filter.languages.length > 0 && filter.languages.length < 3) {
        conditions.push(`c.language_pref = ANY($${paramIdx}::text[])`);
        params.push(filter.languages);
        paramIdx++;
    }

    if (filter.never_purchased) {
        conditions.push("o.id IS NULL");
    }

    // We need to use a subquery for aggregate filters
    let havingClauses: string[] = [];

    if (filter.min_spent !== undefined && filter.min_spent > 0) {
        havingClauses.push(`COALESCE(SUM(o.total), 0) >= ${filter.min_spent}`);
    }
    if (filter.max_spent !== undefined) {
        havingClauses.push(`COALESCE(SUM(o.total), 0) <= ${filter.max_spent}`);
    }
    if (filter.min_order_count !== undefined && filter.min_order_count > 0) {
        havingClauses.push(`COUNT(o.id) >= ${filter.min_order_count}`);
    }
    if (filter.ordered_within_days !== undefined) {
        havingClauses.push(`MAX(o.created_at) >= now() - interval '${filter.ordered_within_days} days'`);
    }
    if (filter.ordered_before_days !== undefined) {
        havingClauses.push(`MAX(o.created_at) < now() - interval '${filter.ordered_before_days} days'`);
    }

    let query = `
        SELECT c.email, c.first_name, c.language_pref
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id AND o.status != 'cancelled'
        WHERE ${conditions.join(" AND ")}
        GROUP BY c.id, c.email, c.first_name, c.language_pref
    `;

    if (havingClauses.length > 0) {
        query += ` HAVING ${havingClauses.join(" AND ")}`;
    }

    // has_purchased_product requires a separate EXISTS check
    if (filter.has_purchased_product && filter.has_purchased_product.length > 0) {
        // Get product IDs from slugs
        const { data: productRows } = await supabaseAdmin
            .from("products")
            .select("id")
            .in("slug", filter.has_purchased_product);

        if (productRows && productRows.length > 0) {
            const productIds = productRows.map(p => `'${p.id}'`).join(",");
            // Wrap in an outer query
            query = `
                SELECT sq.* FROM (${query}) sq
                WHERE EXISTS (
                    SELECT 1 FROM orders o2
                    JOIN order_items oi ON oi.order_id = o2.id
                    JOIN customers c2 ON c2.id = o2.customer_id
                    WHERE c2.email = sq.email AND oi.product_id IN (${productIds})
                )
            `;
        }
    }

    const { data, error } = await supabaseAdmin.rpc("exec_sql", { query_text: query }).select("*");

    // Fallback: if the RPC doesn't exist, use basic Supabase query
    if (error) {
        // Simple fallback: just get all customers with basic language filter
        let q = supabaseAdmin.from("customers").select("email, first_name, language_pref").not("email", "is", null);
        if (filter.languages && filter.languages.length > 0 && filter.languages.length < 3) {
            q = q.in("language_pref", filter.languages);
        }
        const { data: fallbackData } = await q;
        return (fallbackData || []) as { email: string; first_name: string | null; language_pref: string }[];
    }

    return (data || []) as { email: string; first_name: string | null; language_pref: string }[];
}

// Count recipients for a given filter (used by preview)
export async function PUT(req: NextRequest) {
    try {
        const filter = (await req.json()) as AudienceFilter;
        const recipients = await getFilteredRecipients(filter);
        return NextResponse.json({ count: recipients.length });
    } catch (err) {
        return NextResponse.json({ error: "Count failed", count: 0 }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { campaignId, testEmail } = await req.json();

        if (!campaignId) {
            return NextResponse.json({ error: "campaignId required" }, { status: 400 });
        }

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

        if (!testEmail) {
            await supabaseAdmin.from("marketing_campaigns").update({ status: "sending" }).eq("id", campaignId);
        }

        const product = PRODUCTS[campaign.recommended_product_slug] || { name: "CBD Oil", price: 29.95 };

        // Get recipients
        let recipients: { email: string; first_name: string | null; language_pref: string }[] = [];

        if (testEmail) {
            recipients = [{ email: testEmail, first_name: "Test", language_pref: "de" }];
        } else {
            const filter = (campaign.audience_filter || {}) as AudienceFilter;
            recipients = await getFilteredRecipients(filter);
        }

        let sentCount = 0;
        let failedCount = 0;

        for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
            const batch = recipients.slice(i, i + BATCH_SIZE);

            await Promise.allSettled(
                batch.map(async (recipient) => {
                    const locale = recipient.language_pref || "de";
                    const subjectKey = `subject_${locale}` as keyof typeof campaign;
                    const bodyKey = `body_html_${locale}` as keyof typeof campaign;

                    const subject = (campaign[subjectKey] as string) || campaign.subject_de;
                    let bodyHtml = (campaign[bodyKey] as string) || campaign.body_html_de;

                    // Personalize greeting
                    const firstName = recipient.first_name || NAME_FALLBACK[locale] || NAME_FALLBACK.de;
                    bodyHtml = bodyHtml.replace(/\{FIRST_NAME\}/g, firstName);

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

                    const result = await sendEmail({ to: recipient.email, subject, html });

                    await supabaseAdmin.from("email_log").insert({
                        recipient: recipient.email,
                        template: "marketing-newsletter",
                        subject,
                        language: locale,
                        status: result.success ? "sent" : "failed",
                        resend_id: result.id || null,
                        metadata: { campaign_id: campaignId, coupon: campaign.coupon_code, product: campaign.recommended_product_slug },
                    });

                    if (result.success) sentCount++;
                    else failedCount++;
                })
            );

            if (i + BATCH_SIZE < recipients.length) {
                await new Promise((r) => setTimeout(r, BATCH_DELAY));
            }
        }

        if (!testEmail) {
            await supabaseAdmin.from("marketing_campaigns").update({
                status: "sent",
                sent_at: new Date().toISOString(),
                sent_count: sentCount,
                failed_count: failedCount,
            }).eq("id", campaignId);
        }

        return NextResponse.json({ success: true, sent: sentCount, failed: failedCount });
    } catch (err) {
        console.error("[Marketing Send]", err);
        return NextResponse.json({ error: "Send failed" }, { status: 500 });
    }
}
