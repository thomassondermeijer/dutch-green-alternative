import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const GOOGLE_AI_STUDIO_KEY = process.env.GOOGLE_AI_STUDIO_KEY || "";

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

// Forward-looking coupon logic — finds the NEXT upcoming holiday/celebration
function getSeasonalCoupon(): { code: string; discount: number; reason: string } {
    const now = new Date();
    const year = now.getFullYear();
    const yr = year.toString().slice(-2);

    // Easter calculation (Anonymous Gregorian algorithm)
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const easterMonth = Math.floor((h + l - 7 * m + 114) / 31);
    const easterDay = ((h + l - 7 * m + 114) % 31) + 1;
    const easter = new Date(year, easterMonth - 1, easterDay);

    // Calendar of events (month is 0-indexed for Date constructor)
    const events: { date: Date; code: string; discount: number; reason: string }[] = [
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
        // Next year's events (for late December)
        { date: new Date(year + 1, 0, 1), code: "NEWYEAR" + (Number(yr) + 1), discount: 12, reason: "New Year" },
    ];

    // Sort by date and find the next upcoming event (within 21 days)
    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    const upcoming = events.find(e => e.date.getTime() >= now.getTime() - 86400000); // allow 1 day past
    return upcoming || events[0];
}

// ═══ STEP 1: Scrape BudMed Bulletin ═══
// Uses Jina Reader API (r.jina.ai) — free, no auth, renders JS, bypasses Cloudflare.
// Step A: Fetch archive via Jina to find latest issue URL
// Step B: Fetch that post via Jina for clean markdown content

async function scrapeBudMed(): Promise<{ title: string; content: string; url: string }> {
    // Check last fetched issue from DB to avoid re-sending
    const { data: lastCampaign } = await supabaseAdmin
        .from("marketing_campaigns")
        .select("source_url")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    const lastIssueUrl = lastCampaign?.source_url || "";

    // Step A: Get archive page via Jina Reader to find latest issue URL
    const archiveRes = await fetch("https://r.jina.ai/https://budmedbulletin.beehiiv.com/archive", {
        headers: { "Accept": "text/plain" },
    });

    if (!archiveRes.ok) {
        throw new Error(`Jina Reader archive error: ${archiveRes.status}`);
    }

    const archiveText = await archiveRes.text();

    // Extract all issue URLs from the archive markdown
    const issueUrls = [...archiveText.matchAll(/https:\/\/budmedbulletin\.beehiiv\.com\/p\/(issue-\d+[^)\s]*)/g)]
        .map(m => `https://budmedbulletin.beehiiv.com/p/${m[1]}`);

    if (issueUrls.length === 0) {
        throw new Error("No BudMed issues found in archive");
    }

    // Find the first issue we haven't processed yet
    let targetUrl = issueUrls[0]; // Default to latest
    for (const url of issueUrls) {
        if (url !== lastIssueUrl) {
            targetUrl = url;
            break;
        }
    }

    // Step B: Fetch the full post via Jina Reader
    const postRes = await fetch(`https://r.jina.ai/${targetUrl}`, {
        headers: { "Accept": "text/plain" },
    });

    if (!postRes.ok) {
        throw new Error(`Jina Reader post error: ${postRes.status}`);
    }

    const postText = await postRes.text();

    // Extract title from first line or markdown heading
    const titleMatch = postText.match(/^#\s+(.+)$/m) || postText.match(/Title:\s*(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : "BudMed Bulletin";

    // Trim content to 8000 chars for token efficiency
    const content = postText.slice(0, 8000);

    return { title, content, url: targetUrl };
}

// ═══ STEP 2: Claude Sonnet 4.6 Rewrite ═══
async function aiRewrite(sourceContent: string, sourceTitle: string, coupon: { code: string; discount: number; reason: string }) {
    const productList = PRODUCTS.map(p => `- ${p.slug}: ${p.name} (€${p.price}) — good for: ${p.keywords.join(", ")}`).join("\n");

    const prompt = `You are the content writer for Dutch Green Alternative (DGA), a premium European CBD oil brand.
Your audience is 50+ year old health-conscious Europeans interested in natural wellness and CBD research.

TASK: Rewrite the following medical cannabis research newsletter into a DGA marketing email.

SOURCE ARTICLE TITLE: ${sourceTitle}
SOURCE CONTENT:
${sourceContent}

PRODUCTS AVAILABLE:
${productList}

SEASONAL CONTEXT: The upcoming ${coupon.reason} is approaching! Coupon code "${coupon.code}" gives ${coupon.discount}% off.

INSTRUCTIONS:
1. Pick the 2 most IMPACTFUL studies from the source that would resonate with a 50+ audience (pain relief, sleep, brain health, cancer research, inflammation)
2. Each study gets its own <h2> heading + 3-4 sentences explaining the findings
3. CITE THE SOURCE for authority: include the journal name or institution with a link, e.g. <a href="URL">Published in Journal of Oncology</a>
4. Write in DGA's voice: professional but warm, science-backed but accessible, European
5. DO NOT make medical claims — use phrases like "research suggests", "studies indicate", "may support"
6. Recommend ONE product that best matches the combined topics
7. Naturally weave in the coupon code and the upcoming ${coupon.reason}
8. Target length: 400-500 words per language — substantive but readable
9. End with a warm sign-off mentioning DGA

OUTPUT FORMAT (respond in valid JSON only):
{
  "subject_de": "German email subject line (max 60 chars, engaging, use emoji)",
  "subject_nl": "Dutch email subject line (max 60 chars, engaging, use emoji)",
  "subject_en": "English email subject line (max 60 chars, engaging, use emoji)",
  "body_de": "German body in HTML (<h2>, <p>, <strong>, <em>, <a href> tags). Include source citations as links.",
  "body_nl": "Dutch body in HTML. Include source citations as links.",
  "body_en": "English body in HTML. Include source citations as links.",
  "recommended_product": "one of the product slugs from the list above",
  "image_suggestion": "A 1-sentence scene description that fits this email's topic. Describe a lifestyle/wellness setting where the recommended CBD product bottle is naturally placed (e.g. 'A warm evening bedside table with soft lamplight, herbal tea, and the CBD oil bottle, radiating calm and restful energy'). The scene should relate to the studies discussed."
}`;

    if (!OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY not configured. Add it to Netlify Environment Variables.");
    }

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
            max_tokens: 6000,
        }),
    });

    const responseText = await response.text();

    if (!response.ok) {
        throw new Error(`OpenRouter error: ${response.status} - ${responseText.slice(0, 500)}`);
    }

    // Safety: check for HTML response (rate limit pages etc.)
    if (responseText.trimStart().startsWith("<")) {
        throw new Error(`OpenRouter returned HTML instead of JSON: ${responseText.slice(0, 200)}`);
    }

    let data;
    try {
        data = JSON.parse(responseText);
    } catch {
        throw new Error(`OpenRouter response not valid JSON: ${responseText.slice(0, 300)}`);
    }

    const content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Claude did not return valid JSON");

    return JSON.parse(jsonMatch[0]);
}

// ═══ STEP 3: Gemini 3.1 Flash Image (with product reference) ═══
async function generateImage(imageSuggestion: string, productSlug: string): Promise<{ imageUrl: string; prompt: string }> {
    // Fetch the product's actual photo from DB to use as reference
    const { data: product } = await supabaseAdmin
        .from("products")
        .select("image_urls")
        .eq("slug", productSlug)
        .maybeSingle();

    const productImageUrl = product?.image_urls?.[0] || "";
    let productBase64 = "";
    let productMime = "image/jpeg";

    if (productImageUrl) {
        try {
            const imgRes = await fetch(productImageUrl);
            if (imgRes.ok) {
                const arrBuf = await imgRes.arrayBuffer();
                productBase64 = Buffer.from(arrBuf).toString("base64");
                productMime = imgRes.headers.get("content-type") || "image/jpeg";
            }
        } catch { /* continue without reference */ }
    }

    const imagePrompt = `Create a premium lifestyle/wellness photograph: ${imageSuggestion}. The CBD oil bottle from the reference image MUST appear prominently in the scene. Style: editorial product photography, warm natural lighting, soft depth-of-field, premium green and earth tones matching a European CBD brand. Photorealistic. No text overlays, no logos, no faces. High quality, 16:9 ratio.`;

    // Build multimodal parts: text prompt + optional product reference image
    const parts: Array<Record<string, unknown>> = [
        { text: `Generate an image: ${imagePrompt}` },
    ];
    if (productBase64) {
        parts.push({
            inlineData: { mimeType: productMime, data: productBase64 },
        });
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${GOOGLE_AI_STUDIO_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts }],
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
    const resParts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = resParts.find((p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData);

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
            const imgResult = await generateImage(aiResult.image_suggestion, aiResult.recommended_product);
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
