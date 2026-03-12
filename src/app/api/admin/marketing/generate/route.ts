import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const GOOGLE_AI_STUDIO_KEY = process.env.GOOGLE_AI_STUDIO_KEY!;

// Products for AI to recommend
const PRODUCTS = [
    { slug: "cbd-raw-5-5", name: "RAW CBD Öl 5,5%", price: 29.95, keywords: ["beginners", "mild", "entry", "low dose", "starter"] },
    { slug: "cbd-raw-11", name: "RAW CBD Öl 11%", price: 41.95, keywords: ["regular", "medium", "daily", "standard"] },
    { slug: "cbd-gold-35", name: "CBD Gold 35%", price: 84.95, keywords: ["strong", "high dose", "concentrated", "premium"] },
    { slug: "golden-spectrum-35", name: "Golden Spectrum 35% (CBD+CBG+CBN)", price: 89.95, keywords: ["full spectrum", "entourage", "cancer", "multiple cannabinoids", "top tier"] },
    { slug: "cbg-raw-12", name: "CBG RAW 12%", price: 49.95, keywords: ["cbg", "inflammation", "gut", "brain", "neuroprotection"] },
    { slug: "mind-comfort-8", name: "Mind Comfort", price: 44.95, keywords: ["anxiety", "stress", "mental", "brain", "focus", "depression"] },
    { slug: "good-night-8", name: "Good Night", price: 44.95, keywords: ["sleep", "insomnia", "rest", "relaxation", "night"] },
    { slug: "body-harmony-8", name: "Body Harmony", price: 44.95, keywords: ["pain", "body", "muscles", "joints", "physical", "inflammation"] },
];

// Seasonal coupon logic
function getSeasonalCoupon(): { code: string; discount: number; reason: string } {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    // Holiday-specific
    if (month === 12 && day >= 1 && day <= 31) return { code: "KERST" + now.getFullYear().toString().slice(-2), discount: 15, reason: "Christmas" };
    if (month === 1 && day <= 15) return { code: "NEWYEAR" + now.getFullYear().toString().slice(-2), discount: 12, reason: "New Year" };
    if (month === 2 && day >= 10 && day <= 14) return { code: "VALENTINE" + now.getFullYear().toString().slice(-2), discount: 10, reason: "Valentine's Day" };
    if (month === 4 && day >= 1 && day <= 21) return { code: "OSTERN" + now.getFullYear().toString().slice(-2), discount: 12, reason: "Easter" };
    if (month === 4 && day >= 22 && day <= 30) return { code: "KONINGSDAG" + now.getFullYear().toString().slice(-2), discount: 10, reason: "King's Day" };
    if (month === 5 && day >= 1 && day <= 12) return { code: "MUTTERTAG" + now.getFullYear().toString().slice(-2), discount: 10, reason: "Mother's Day" };
    if (month === 6 && day >= 15 && day <= 21) return { code: "VATERTAG" + now.getFullYear().toString().slice(-2), discount: 10, reason: "Father's Day" };
    if (month === 11 && day >= 20 && day <= 30) return { code: "BLACKFRIDAY" + now.getFullYear().toString().slice(-2), discount: 20, reason: "Black Friday" };

    // Seasonal
    if (month >= 3 && month <= 5) return { code: "SPRING" + now.getFullYear().toString().slice(-2), discount: 10, reason: "Spring" };
    if (month >= 6 && month <= 8) return { code: "SUMMER" + now.getFullYear().toString().slice(-2), discount: 10, reason: "Summer" };
    if (month >= 9 && month <= 11) return { code: "HERBST" + now.getFullYear().toString().slice(-2), discount: 10, reason: "Autumn" };
    return { code: "WINTER" + now.getFullYear().toString().slice(-2), discount: 10, reason: "Winter" };
}

// ═══ STEP 1: Scrape BudMed Bulletin ═══
// Beehiiv archive is JS-rendered + Cloudflare-protected, but individual posts work
// with a browser User-Agent. We scan issue numbers to find the latest.
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const KNOWN_LATEST_ISSUE = 78; // Update as needed, will auto-scan upward

async function scrapeBudMed(): Promise<{ title: string; content: string; url: string }> {
    // Check last fetched issue from DB to avoid re-sending
    const { data: lastCampaign } = await supabaseAdmin
        .from("marketing_campaigns")
        .select("source_url")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    const lastIssueSlugs = lastCampaign?.source_url || "";

    // Try to find the newest issue by scanning UP from known latest
    let issueNum = KNOWN_LATEST_ISSUE + 5; // Start a few ahead
    let issueUrl = "";
    let issueHtml = "";

    // Scan downward to find the highest existing issue
    for (let i = issueNum; i >= KNOWN_LATEST_ISSUE; i--) {
        // BudMed uses "issue-XX-" prefix in their slugs
        const testUrl = `https://budmedbulletin.beehiiv.com/p/issue-${i}`;
        const res = await fetch(testUrl, {
            headers: { "User-Agent": BROWSER_UA, "Accept": "text/html" },
            redirect: "follow",
        });

        // Beehiiv redirects to full slug if prefix matches
        if (res.ok && res.url.includes(`/p/issue-${i}`)) {
            const html = await res.text();
            // Verify it's actual content (not a Cloudflare challenge)
            if (html.length > 10000 && html.includes("<title>")) {
                // Skip if we already processed this URL
                if (lastIssueSlugs && res.url === lastIssueSlugs) {
                    // Same issue — try a lower one instead of reusing
                    continue;
                }
                issueUrl = res.url;
                issueHtml = html;
                break;
            }
        }
    }

    if (!issueUrl || !issueHtml) {
        throw new Error("Could not find any new BudMed issue");
    }

    // Extract title
    const titleMatch = issueHtml.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].split("|")[0].trim() : "BudMed Bulletin";

    // Strip HTML to get text content
    let content = issueHtml
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000);

    return { title, content, url: issueUrl };
}

// ═══ STEP 2: Claude Sonnet 4.6 Rewrite ═══
async function aiRewrite(sourceContent: string, sourceTitle: string, coupon: { code: string; discount: number; reason: string }) {
    const productList = PRODUCTS.map(p => `- ${p.slug}: ${p.name} (€${p.price}) — good for: ${p.keywords.join(", ")}`).join("\n");

    const prompt = `You are the content writer for Dutch Green Alternative (DGA), a premium European CBD oil brand.

TASK: Rewrite the following medical cannabis research newsletter into a DGA marketing email.

SOURCE ARTICLE TITLE: ${sourceTitle}
SOURCE CONTENT:
${sourceContent}

PRODUCTS AVAILABLE:
${productList}

SEASONAL CONTEXT: It's ${coupon.reason} season, coupon code "${coupon.code}" gives ${coupon.discount}% off.

INSTRUCTIONS:
1. Pick 1-2 of the most interesting studies from the source that relate to CBD/CBG benefits
2. Rewrite them in DGA's voice: professional but warm, science-backed but accessible, European
3. DO NOT make medical claims — use phrases like "research suggests", "studies show", "may support"
4. Recommend ONE product that best matches the topic
5. Naturally weave in the coupon code
6. Keep it concise — 200-300 words max per language

OUTPUT FORMAT (respond in valid JSON only):
{
  "subject_de": "German email subject line (max 60 chars, engaging)",
  "subject_nl": "Dutch email subject line",
  "subject_en": "English email subject line",
  "body_de": "German body text in HTML (use <h2>, <p>, <strong>, <em> tags only)",
  "body_nl": "Dutch body text in HTML",
  "body_en": "English body text in HTML",
  "recommended_product": "one of the product slugs from the list above",
  "image_suggestion": "a 1-sentence description of what image would fit this email (nature/wellness theme, no text)"
}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
            model: "anthropic/claude-sonnet-4.6",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 4000,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenRouter error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Claude did not return valid JSON");

    return JSON.parse(jsonMatch[0]);
}

// ═══ STEP 3: Gemini 3.1 Flash Image ═══
async function generateImage(imageSuggestion: string): Promise<{ imageUrl: string; prompt: string }> {
    const imagePrompt = `Professional wellness photography: ${imageSuggestion}. Style: clean, modern, natural green tones matching a premium CBD brand. Soft lighting, minimalist composition. No text, no logos, no people's faces. High quality, editorial style.`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${GOOGLE_AI_STUDIO_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Generate an image: ${imagePrompt}` }] }],
                generationConfig: {
                    responseModalities: ["TEXT", "IMAGE"],
                },
            }),
        }
    );

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini image error: ${response.status} - ${err}`);
    }

    const data = await response.json();

    // Find the image part in the response
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData);

    if (!imagePart?.inlineData) {
        throw new Error("Gemini did not return an image");
    }

    // Upload to Supabase Storage
    const base64Data = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const ext = mimeType.includes("jpeg") ? "jpg" : "png";
    const fileName = `marketing/newsletter-${Date.now()}.${ext}`;

    const buffer = Buffer.from(base64Data, "base64");

    const { error: uploadError } = await supabaseAdmin.storage
        .from("DGA")
        .upload(fileName, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) throw new Error(`Storage upload error: ${uploadError.message}`);

    const { data: urlData } = supabaseAdmin.storage.from("DGA").getPublicUrl(fileName);

    return { imageUrl: urlData.publicUrl, prompt: imagePrompt };
}

// ═══ MAIN HANDLER ═══
export async function POST(req: NextRequest) {
    try {
        const log: Record<string, unknown> = {};

        // Step 1: Scrape
        log.scrape_start = new Date().toISOString();
        const source = await scrapeBudMed();
        log.scrape_done = new Date().toISOString();
        log.source_title = source.title;
        log.source_url = source.url;

        // Step 2: Coupon
        const coupon = getSeasonalCoupon();
        log.coupon = coupon;

        // Check if coupon already exists, create if not
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
                valid_from: new Date().toISOString(),
                valid_until: new Date(Date.now() + 30 * 86400000).toISOString(), // 30 days
                max_uses: 999,
                usage_count: 0,
            });
        }

        // Step 3: AI Rewrite
        log.ai_start = new Date().toISOString();
        const aiResult = await aiRewrite(source.content, source.title, coupon);
        log.ai_done = new Date().toISOString();
        log.recommended_product = aiResult.recommended_product;

        // Step 4: Generate Image
        log.image_start = new Date().toISOString();
        let imageUrl = "";
        let imagePrompt = "";
        try {
            const imgResult = await generateImage(aiResult.image_suggestion);
            imageUrl = imgResult.imageUrl;
            imagePrompt = imgResult.prompt;
        } catch (imgErr) {
            log.image_error = String(imgErr);
            // Continue without image — not a deal-breaker
        }
        log.image_done = new Date().toISOString();

        // Step 5: Save campaign draft
        const { data: campaign, error } = await supabaseAdmin
            .from("marketing_campaigns")
            .insert({
                source_url: source.url,
                source_title: source.title,
                subject_de: aiResult.subject_de,
                subject_nl: aiResult.subject_nl,
                subject_en: aiResult.subject_en,
                body_html_de: aiResult.body_de,
                body_html_nl: aiResult.body_nl,
                body_html_en: aiResult.body_en,
                image_url: imageUrl,
                image_prompt: imagePrompt,
                recommended_product_slug: aiResult.recommended_product,
                coupon_code: coupon.code,
                coupon_discount: coupon.discount,
                status: "draft",
                generation_log: log,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, campaign });
    } catch (err) {
        console.error("[Marketing Generate]", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Generation failed" },
            { status: 500 }
        );
    }
}
