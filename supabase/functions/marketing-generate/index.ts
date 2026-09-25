import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * marketing-generate
 *
 * Turns a scraped BudMed article into a three-language DGA newsletter draft:
 * picks the seasonal coupon, writes the copy with a language model, renders a
 * product image, and leaves the campaign in `draft` for review.
 *
 * Deployed from supabase/functions/marketing-generate/index.ts in the repo.
 * Invoked by /api/admin/marketing/generate on the Next.js side.
 *
 * Request handling is deliberately split in two: the request is validated and
 * acknowledged with 202 immediately, and the multi-minute pipeline runs as a
 * background task. The caller is a Netlify serverless function that cannot
 * wait minutes for a response — and a fire-and-forget fetch from it was being
 * dropped before the request ever left, which is how the 10 Sep campaign sat
 * in `generating` for a week with an empty log.
 */

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const KIE_AI_API_KEY = Deno.env.get("KIE_AI_API_KEY") || "";

/** Same model as the rest of the app — keep in step with MODEL in src/lib/ai/openrouter.ts. */
const MODEL = "google/gemini-3.8-flash";

type Product = { slug: string; name: string; price: number };

/**
 * The catalogue comes from the database. A hardcoded list here knew only 5 of
 * the 8 active products, so Mind Comfort, Good Night and Body Harmony could
 * never be recommended.
 */
async function loadProducts(): Promise<Product[]> {
  const { data } = await supabaseAdmin
    .from("products")
    .select("slug, price, translations")
    .eq("is_active", true)
    .order("sort_order", { nullsFirst: false });

  return (data || []).map((row: { slug: string; price: string | number; translations: Record<string, { name?: string }> | null }) => ({
    slug: row.slug,
    name: row.translations?.de?.name || row.slug,
    price: Number(row.price),
  }));
}

// ── Link policy ────────────────────────────────────────────────────────────
// Keep in step with ALLOWED_LINK_DOMAINS in src/lib/marketing/links.ts.
// Newsletter platforms (beehiiv, substack) are deliberately absent: that is
// where the source article lives, and linking it sends readers to a rival.
const ALLOWED_LINK_DOMAINS = [
  "dutchgreenalternative.nl",
  "nih.gov", "doi.org", "clinicaltrials.gov", "who.int", "cochranelibrary.com",
  "nature.com", "science.org", "sciencedirect.com", "elsevier.com", "thelancet.com",
  "bmj.com", "jamanetwork.com", "nejm.org", "cell.com", "pnas.org",
  "springer.com", "springeropen.com", "biomedcentral.com", "wiley.com",
  "tandfonline.com", "mdpi.com", "frontiersin.org", "plos.org", "oup.com",
  "sagepub.com", "ahajournals.org", "karger.com", "acs.org", "rsc.org",
];

function isAllowedLinkTarget(href: string): boolean {
  const value = href.trim();
  if (!value) return false;
  if (/^\{[A-Z_]+\}$/.test(value)) return true;      // {PRODUCT_URL} etc.
  if (/^(mailto:|tel:|#)/i.test(value)) return true;
  let host: string;
  try { host = new URL(value).hostname.toLowerCase(); } catch { return false; }
  return ALLOWED_LINK_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Unwrap links to anywhere not allowed, keeping the words so prose still reads. */
function sanitizeCampaignLinks(html: string): { html: string; removed: string[] } {
  if (!html) return { html: "", removed: [] };
  const removed: string[] = [];
  const cleaned = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (whole, attrs: string, inner: string) => {
    const m = /href\s*=\s*["']([^"']*)["']/i.exec(attrs);
    const href = m ? m[1] : "";
    if (href && isAllowedLinkTarget(href)) return whole;
    removed.push(href || "(no href)");
    return inner;
  });
  return { html: cleaned, removed };
}

type SeasonalEvent = { date: Date; code: string; discount: number; reason: string; reason_de: string; reason_nl: string };

function getAllSeasonalEvents(): SeasonalEvent[] {
  const now = new Date();
  const year = now.getFullYear();
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
  const events: SeasonalEvent[] = [
    { date: new Date(year, 0, 1), code: "NEWYEAR" + yr, discount: 12, reason: "New Year", reason_de: "Neujahr", reason_nl: "Nieuwjaar" },
    { date: new Date(year, 1, 14), code: "VALENTINE" + yr, discount: 10, reason: "Valentine's Day", reason_de: "Valentinstag", reason_nl: "Valentijnsdag" },
    { date: new Date(year, 2, 20), code: "SLEEPDAY" + yr, discount: 10, reason: "World Sleep Day", reason_de: "Weltschlaftag", reason_nl: "Wereldslaapdag" },
    { date: new Date(year, 2, 21), code: "SPRING" + yr, discount: 10, reason: "First Day of Spring", reason_de: "Frühlingsbeginn", reason_nl: "Eerste dag van de Lente" },
    { date: new Date(year, 3, 7), code: "HEALTHDAY" + yr, discount: 10, reason: "World Health Day", reason_de: "Weltgesundheitstag", reason_nl: "Wereldgezondheidsdag" },
    { date: easter, code: "OSTERN" + yr, discount: 12, reason: "Easter", reason_de: "Ostern", reason_nl: "Pasen" },
    { date: new Date(year, 3, 27), code: "KONINGSDAG" + yr, discount: 10, reason: "King's Day", reason_de: "Königstag", reason_nl: "Koningsdag" },
    { date: new Date(year, 4, 11), code: "MUTTERTAG" + yr, discount: 10, reason: "Mother's Day", reason_de: "Muttertag", reason_nl: "Moederdag" },
    { date: new Date(year, 5, 15), code: "VATERTAG" + yr, discount: 10, reason: "Father's Day", reason_de: "Vatertag", reason_nl: "Vaderdag" },
    { date: new Date(year, 5, 21), code: "SUMMER" + yr, discount: 10, reason: "First Day of Summer", reason_de: "Sommeranfang", reason_nl: "Eerste dag van de Zomer" },
    { date: new Date(year, 8, 21), code: "WELLNESS" + yr, discount: 10, reason: "World Gratitude Day", reason_de: "Welt-Dankbarkeitstag", reason_nl: "Werelddankbaarheidsdag" },
    { date: new Date(year, 8, 23), code: "HERBST" + yr, discount: 10, reason: "First Day of Autumn", reason_de: "Herbstbeginn", reason_nl: "Eerste dag van de Herfst" },
    { date: new Date(year, 9, 10), code: "MENTALHEALTH" + yr, discount: 10, reason: "World Mental Health Day", reason_de: "Welttag der psychischen Gesundheit", reason_nl: "Werelddag van de Geestelijke Gezondheid" },
    { date: new Date(year, 10, 28), code: "BLACKFRIDAY" + yr, discount: 20, reason: "Black Friday", reason_de: "Black Friday", reason_nl: "Black Friday" },
    { date: new Date(year, 11, 21), code: "WINTER" + yr, discount: 10, reason: "First Day of Winter", reason_de: "Winteranfang", reason_nl: "Eerste dag van de Winter" },
    { date: new Date(year, 11, 25), code: "KERST" + yr, discount: 15, reason: "Christmas", reason_de: "Weihnachten", reason_nl: "Kerst" },
    { date: new Date(year + 1, 0, 1), code: "NEWYEAR" + (Number(yr) + 1), discount: 12, reason: "New Year", reason_de: "Neujahr", reason_nl: "Nieuwjaar" },
  ];
  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  return events;
}

async function updateLog(campaignId: string, log: Record<string, unknown>) {
  await supabaseAdmin.from("marketing_campaigns").update({
    generation_log: log,
  }).eq("id", campaignId);
}

async function markFailed(campaignId: string, log: Record<string, unknown>, reason: string) {
  log.step = "FAILED";
  log.error = reason;
  log.failed_at = new Date().toISOString();
  try {
    await supabaseAdmin.from("marketing_campaigns").update({
      status: "failed", generation_log: log,
    }).eq("id", campaignId);
  } catch { /* the log is best-effort; the failure itself is what matters */ }
}

/**
 * Poll Kie.ai task until complete or timeout.
 * Returns resultImageUrl on success, throws on failure/timeout.
 */
async function pollKieAiTask(taskId: string, timeoutMs = 180000): Promise<string> {
  const interval = 5000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, interval));

    const res = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${KIE_AI_API_KEY}` },
    });

    if (!res.ok) {
      throw new Error(`Kie.ai poll HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const taskData = data?.data;

    if (taskData?.state === "success" || taskData?.successFlag === 1) {
      let resultUrl = taskData?.response?.resultImageUrl;
      if (!resultUrl && taskData?.resultJson) {
        try {
          const parsed = JSON.parse(taskData.resultJson);
          resultUrl = parsed?.resultUrls?.[0];
        } catch { /* ignore */ }
      }
      if (!resultUrl) throw new Error(`Kie.ai task succeeded but no image URL found in ${JSON.stringify(taskData)}`);
      return resultUrl;
    }

    if (taskData?.state === "fail" || taskData?.successFlag === -1) {
      throw new Error(`Kie.ai task failed: ${taskData?.failMsg || JSON.stringify(taskData)}`);
    }
  }

  throw new Error("Kie.ai task timed out");
}

/** The pipeline. Runs after the HTTP response has already been sent. */
async function generate(campaignId: string, articleId: string, log: Record<string, unknown>) {
  try {
    // ====== STEP 0: Determine seasonal event ======
    log.step = "0_picking_seasonal_event";
    log.step0_start = new Date().toISOString();
    await updateLog(campaignId, log);

    const { data: existingCampaigns } = await supabaseAdmin
      .from("marketing_campaigns")
      .select("coupon_code")
      .neq("id", campaignId)
      .in("status", ["draft", "approved", "sent"]);

    const usedCodes = new Set((existingCampaigns || []).map((c: { coupon_code: string | null }) => c.coupon_code).filter(Boolean));
    log.step0_used_codes = Array.from(usedCodes);

    const allEvents = getAllSeasonalEvents();
    const now = Date.now() - 86400000;
    const upcomingEvents = allEvents.filter(e => e.date.getTime() >= now);
    const coupon = upcomingEvents.find(e => !usedCodes.has(e.code)) || upcomingEvents[0] || allEvents[0];

    log.step0_picked = coupon.code;
    log.step0_reason = coupon.reason;
    log.step = "0_done";
    await updateLog(campaignId, log);

    // ====== STEP 1: Fetch article ======
    log.step = "1_fetching_article";
    log.step1_start = new Date().toISOString();
    await updateLog(campaignId, log);

    const { data: article, error: artErr } = await supabaseAdmin
      .from("budmed_articles")
      .select("*")
      .eq("id", articleId)
      .single();
    if (artErr || !article) {
      log.step1_error = artErr?.message || "Article not found";
      await updateLog(campaignId, log);
      throw new Error(log.step1_error as string);
    }

    log.step = "1_done";
    log.step1_done = new Date().toISOString();
    log.article_title = article.title;
    await updateLog(campaignId, log);

    await supabaseAdmin.from("marketing_campaigns").update({
      source_url: article.url, source_title: article.title, article_id: articleId,
    }).eq("id", campaignId);

    // ====== STEP 2: Create coupon in DB ======
    log.step = "2_creating_coupon";
    await updateLog(campaignId, log);

    const { data: existingCoupon } = await supabaseAdmin.from("coupons").select("id").eq("code", coupon.code).maybeSingle();
    if (!existingCoupon) {
      const { error: couponErr } = await supabaseAdmin.from("coupons").insert({
        code: coupon.code, discount_type: "percentage", discount_value: coupon.discount,
        is_active: true, valid_from: new Date().toISOString(),
        valid_until: new Date(Date.now() + 30 * 86400000).toISOString(),
        usage_limit: 999, usage_count: 0,
        description: `Auto-generated for ${coupon.reason} newsletter campaign`,
      });
      if (couponErr) log.step2_coupon_insert_error = couponErr.message;
      else log.step2_coupon_created = true;
    } else {
      log.step2_coupon_existed = true;
    }

    await supabaseAdmin.from("marketing_campaigns").update({
      coupon_code: coupon.code, coupon_discount: coupon.discount, coupon_reason: coupon.reason,
    }).eq("id", campaignId);
    log.step = "2_done";
    await updateLog(campaignId, log);

    // ====== STEP 3: Write the copy ======
    log.step = "3_calling_model";
    log.step3_model = MODEL;
    log.step3_start = new Date().toISOString();
    await updateLog(campaignId, log);

    const products = await loadProducts();
    if (products.length === 0) {
      log.step3_error = "No active products found in the catalogue";
      await updateLog(campaignId, log);
      throw new Error(log.step3_error as string);
    }
    log.step3_product_count = products.length;

    const productList = products.map(p => `- ${p.slug}: ${p.name} (€${p.price.toFixed(2)})`).join("\n");

    const cancerInstruction = article.has_cancer_content
      ? `This article contains CANCER-RELATED research. You MUST:\n- Make subject option 1 about the cancer study specifically\n- Make subject option 2 about a different 50+ health topic from the article\n- Make subject option 3 a curiosity/question angle about the cancer findings\n- In the body, the FIRST <h2> section should cover the cancer study with strong authority citations\n- The SECOND <h2> should cover the other health topic for a 50+ audience`
      : `This article does NOT contain cancer research. Focus on the 2 most impactful studies for a 50+ audience:\n- Topics to prioritize: pain relief, sleep improvement, brain health, inflammation, joint health, cardiovascular health\n- Subject option 1: research/authority angle\n- Subject option 2: benefit/emotional angle\n- Subject option 3: curiosity/question angle`;

    const truncatedContent = (article.content || "").slice(0, 8000);

    // The studies the source issue actually links to, resolved against PubMed
    // by the scraper. Handed over separately because the prose above is
    // truncated and the links sit at the end of it.
    type SourceLink = { url: string; title?: string; journal?: string; year?: string };
    const sourceLinks: SourceLink[] = Array.isArray(article.source_links) ? article.source_links : [];
    log.citable_source_count = sourceLinks.length;

    const citableBlock = sourceLinks.length > 0
      ? `CITABLE SOURCES — the studies this issue is based on. These are the ONLY research URLs you may link:
${sourceLinks.map((l) => `- ${l.url}
    ${l.title || "(title unavailable)"}${l.journal ? ` — ${l.journal}` : ""}${l.year ? `, ${l.year}` : ""}`).join("\n")}

Match each link to the section it belongs to by its TITLE, not by its position in this list. If no title
matches a section, that section gets no link.`
      : `CITABLE SOURCES: none were found in this issue. Cite journals in plain text only — do NOT link any research.`;

    const prompt = `You are the content writer for Dutch Green Alternative (DGA), a premium European CBD oil brand.
Your audience is 50+ year old health-conscious Europeans interested in natural wellness and CBD research.

TASK: Rewrite the following medical cannabis research newsletter into a DGA marketing email.

SOURCE ARTICLE: ${article.title}
${truncatedContent}

OUR PRODUCTS — recommend one of these, by slug:
${productList}

SEASONAL CONTEXT: The seasonal event and its LOCALIZED names are:
- English: "${coupon.reason}"
- German: "${coupon.reason_de}"
- Dutch: "${coupon.reason_nl}"
The discount is automatically applied when clicking the product link.

${citableBlock}

${cancerInstruction}

IMPORTANT RULES:
1. Each study gets its own <h2> heading + 3-4 sentences explaining findings
2. LINKS — strict. Anything breaking these rules is stripped automatically before the draft is saved:
   a) NEVER link to the source article above, to the newsletter it came from, or to any newsletter
      platform (beehiiv, substack, mailchimp, ghost), and never to another CBD shop. Those send our
      readers to a competitor's list.
   b) You MAY cite research, but ONLY by copying a URL verbatim from CITABLE SOURCES above.
      Link it on the study's name or journal, e.g.
      <a href="https://pubmed.ncbi.nlm.nih.gov/16908594/">published in Molecular Cancer Research</a>.
   c) NEVER invent, guess, shorten or reconstruct a URL, and never write a PubMed search link — a
      fabricated citation is worse than none. If CITABLE SOURCES is empty, or no listed title
      matches the section you are writing, cite in plain text with no anchor at all:
      "published in the Journal of Oncology".
   d) Link the recommended product exactly once, as <a href="{PRODUCT_URL}">…</a>. Write the
      placeholder literally — it is replaced with the real product page, discount applied, before
      sending. NEVER write a dutchgreenalternative URL yourself.
   e) You may link the whole range at most once, as <a href="{SHOP_URL}">…</a>.
3. DGA voice: professional but warm, science-backed, European
4. NO medical claims — use "research suggests", "studies indicate", "may support"
5. Recommend ONE product from the list above that best matches the article topic
6. The discount applies to ALL products in the store, not just the recommended product. When mentioning the discount, ALWAYS say it applies to all products / the entire range. Examples:
   - DE: "Anlässlich ${coupon.reason_de} erhalten Sie {DISCOUNT}% Rabatt auf unser gesamtes Sortiment"
   - NL: "Ter ere van ${coupon.reason_nl} bieden we {DISCOUNT}% korting op al onze producten"
   - EN: "In honor of ${coupon.reason}, enjoy {DISCOUNT}% off all our products"
   NEVER write the discount as applying to a single specific product.
7. When mentioning the discount %, ALWAYS use {DISCOUNT} placeholder (e.g. "{DISCOUNT}% Rabatt"). It will be replaced before sending.
8. Use the LOCALIZED seasonal event name in each language:
   - German body: use "${coupon.reason_de}"
   - Dutch body: use "${coupon.reason_nl}"
   - English body: use "${coupon.reason}"
   Do NOT include any coupon code.
9. 400-500 words per language
10. Start with "Liebe/r {FIRST_NAME}," (DE), "Beste {FIRST_NAME}," (NL), "Dear {FIRST_NAME}," (EN)
11. End with a warm sign-off from DGA
12. ALL subject lines MUST start with "Newsletter:" followed by a space
13. Generate 3 DIFFERENT subject line options per language (research, benefit, curiosity)
14. No coupon code in email body — discount is auto-applied via product link
15. NEVER hardcode a discount number — always use {DISCOUNT}

OUTPUT FORMAT — Return ONLY valid JSON, no markdown:
{
  "subject_options": [
    { "de": "Newsletter: ...", "nl": "Newsletter: ...", "en": "Newsletter: ...", "angle": "research" },
    { "de": "Newsletter: ...", "nl": "Newsletter: ...", "en": "Newsletter: ...", "angle": "benefit" },
    { "de": "Newsletter: ...", "nl": "Newsletter: ...", "en": "Newsletter: ...", "angle": "curiosity" }
  ],
  "body_de": "<p>German HTML using '${coupon.reason_de}'</p>",
  "body_nl": "<p>Dutch HTML using '${coupon.reason_nl}'</p>",
  "body_en": "<p>English HTML using '${coupon.reason}'</p>",
  "recommended_product": "slug-from-list",
  "image_suggestion": "2-3 sentence scene description that fits the email copy and the recommended product"
}`;

    log.prompt_length = prompt.length;
    await updateLog(campaignId, log);

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://dutchgreenalternative.nl",
        "X-Title": "Dutch Green Alternative",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        // Gemini 3.x Flash cannot switch reasoning off and its reasoning tokens
        // count against max_tokens — so the budget is sized for three ~500-word
        // bodies plus the thinking that precedes them.
        max_tokens: 16000,
        reasoning: { effort: "low" },
        response_format: { type: "json_object" },
      }),
    });

    log.step3_http_status = aiRes.status;
    const aiText = await aiRes.text();
    log.step3_response_length = aiText.length;

    if (!aiRes.ok) {
      log.step3_error = `OpenRouter HTTP ${aiRes.status}: ${aiText.slice(0, 500)}`;
      await updateLog(campaignId, log);
      throw new Error(log.step3_error as string);
    }

    log.step = "3_parsing_response";
    await updateLog(campaignId, log);

    // ====== STEP 4: Parse AI response ======
    let aiData;
    try { aiData = JSON.parse(aiText); } catch (e) {
      log.step4_error = `Parse error: ${(e as Error).message}`;
      await updateLog(campaignId, log);
      throw new Error(log.step4_error as string);
    }

    if (aiData.choices?.[0]?.finish_reason === "length") {
      log.step4_error = "Model output was truncated (max_tokens too low for this article)";
      await updateLog(campaignId, log);
      throw new Error(log.step4_error as string);
    }

    const aiContent: string = aiData.choices?.[0]?.message?.content || "";
    const jsonMatch = aiContent.match(/{[\s\S]*}/);
    if (!jsonMatch) {
      log.step4_error = `No JSON found in response`;
      await updateLog(campaignId, log);
      throw new Error(log.step4_error as string);
    }

    let aiResult;
    try { aiResult = JSON.parse(jsonMatch[0]); } catch (e) {
      log.step4_error = `JSON parse error: ${(e as Error).message}`;
      await updateLog(campaignId, log);
      throw new Error(log.step4_error as string);
    }

    if (!aiResult.body_de || !aiResult.body_nl || !aiResult.body_en) {
      log.step4_error = "Model returned JSON without all three language bodies";
      await updateLog(campaignId, log);
      throw new Error(log.step4_error as string);
    }

    log.step = "4_done";
    log.ai_recommended_product = aiResult.recommended_product;
    await updateLog(campaignId, log);

    // The prompt asks for our links only; this enforces it. The model cites what
    // it reads, and what it reads is a rival's newsletter.
    const linkReport: Record<string, string[]> = {};
    for (const key of ["body_de", "body_nl", "body_en"] as const) {
      const { html, removed } = sanitizeCampaignLinks(aiResult[key]);
      aiResult[key] = html;
      if (removed.length > 0) linkReport[key] = removed;
    }
    if (Object.keys(linkReport).length > 0) {
      log.step4_links_removed = linkReport;
      console.warn(`[marketing-generate] stripped disallowed links: ${JSON.stringify(linkReport)}`);
    }

    // A slug the model invented would silently 404 on every CTA.
    if (!products.some((p) => p.slug === aiResult.recommended_product)) {
      log.step4_product_fallback = `${aiResult.recommended_product} is not in the catalogue`;
      aiResult.recommended_product = products[0].slug;
    }
    await updateLog(campaignId, log);

    const defaultSubject = aiResult.subject_options?.[0] || {};
    await supabaseAdmin.from("marketing_campaigns").update({
      subject_de: defaultSubject.de || "Newsletter",
      subject_nl: defaultSubject.nl || "Newsletter",
      subject_en: defaultSubject.en || "Newsletter",
      subject_options: aiResult.subject_options || [],
      body_html_de: aiResult.body_de,
      body_html_nl: aiResult.body_nl,
      body_html_en: aiResult.body_en,
      recommended_product_slug: aiResult.recommended_product,
    }).eq("id", campaignId);

    // ====== STEP 5: Product image ======
    log.step = "5_generating_image";
    log.step5_start = new Date().toISOString();
    await updateLog(campaignId, log);

    let imageUrl: string | null = null;
    let imagePrompt = "";

    try {
      if (!KIE_AI_API_KEY) {
        log.step5_skipped = "KIE_AI_API_KEY not set";
      } else {
        const { data: product } = await supabaseAdmin
          .from("products")
          .select("image_urls")
          .eq("slug", aiResult.recommended_product)
          .maybeSingle();
        const productImageUrl: string = product?.image_urls?.[0] || "";

        imagePrompt = `Create a premium lifestyle/wellness photograph: ${aiResult.image_suggestion}. The CBD oil bottle (10ml size) from the reference image MUST appear prominently. Style: editorial product photography, warm natural lighting, soft depth-of-field, premium green and earth tones. Photorealistic. No text, no logos, no faces. 16:9 ratio.`;

        log.step5_product_image_url = productImageUrl;
        log.step5_image_prompt = imagePrompt;
        await updateLog(campaignId, log);

        const kieModel = productImageUrl ? "gpt-image-2-image-to-image" : "gpt-image-2-text-to-image";
        const kieInput: Record<string, unknown> = {
          prompt: imagePrompt,
          aspect_ratio: "16:9",
          resolution: "1K",
        };
        if (productImageUrl) {
          kieInput.input_urls = [productImageUrl];
        }

        const kieRes = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${KIE_AI_API_KEY}`,
          },
          body: JSON.stringify({ model: kieModel, input: kieInput }),
        });

        log.step5_kie_http_status = kieRes.status;

        if (!kieRes.ok) {
          const errText = await kieRes.text();
          log.step5_kie_error = `HTTP ${kieRes.status}: ${errText.slice(0, 300)}`;
        } else {
          const kieData = await kieRes.json();
          const taskId = kieData?.data?.taskId;
          log.step5_kie_task_id = taskId;
          await updateLog(campaignId, log);

          if (!taskId) {
            log.step5_kie_error = `No taskId in response: ${JSON.stringify(kieData)}`;
          } else {
            log.step5_kie_polling = true;
            await updateLog(campaignId, log);

            const resultImageUrl = await pollKieAiTask(taskId);
            log.step5_kie_result_url = resultImageUrl;

            // Kie.ai URLs are temporary — copy the image into our own storage.
            const imgRes = await fetch(resultImageUrl);
            if (!imgRes.ok) {
              log.step5_download_error = `HTTP ${imgRes.status}`;
            } else {
              const arrBuf = await imgRes.arrayBuffer();
              const bytes = new Uint8Array(arrBuf);
              const contentType = imgRes.headers.get("content-type") || "image/png";
              const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
              const fileName = `marketing/newsletter-${Date.now()}.${ext}`;

              const { error: uploadError } = await supabaseAdmin.storage
                .from("DGA")
                .upload(fileName, bytes, { contentType, upsert: true });

              if (uploadError) {
                log.step5_upload_error = uploadError.message;
              } else {
                const { data: urlData } = supabaseAdmin.storage.from("DGA").getPublicUrl(fileName);
                imageUrl = urlData.publicUrl;
                log.step5_image_url = imageUrl;
              }
            }
          }
        }
      }
    } catch (imgErr) {
      // A missing image is a draft without a picture, not a failed campaign.
      log.step5_error = (imgErr as Error).message;
    }

    log.step = "5_done";
    await updateLog(campaignId, log);

    // ====== STEP 6: Finalize ======
    await supabaseAdmin.from("marketing_campaigns").update({
      image_url: imageUrl, image_prompt: imagePrompt, status: "draft",
    }).eq("id", campaignId);

    log.step = "6_done";
    log.completed = new Date().toISOString();
    await updateLog(campaignId, log);
  } catch (err) {
    console.error("[marketing-generate]", err);
    await markFailed(campaignId, log, err instanceof Error ? err.message : String(err));
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  let body: { campaignId?: string; articleId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }

  const campaignId = body.campaignId || "";
  const articleId = body.articleId || "";
  if (!campaignId || !articleId) {
    return json({ error: "campaignId and articleId required" }, 400);
  }

  const log: Record<string, unknown> = { started_at: new Date().toISOString() };

  // Check the one thing that makes the whole pipeline pointless before
  // acknowledging — a missing key used to surface only at step 3, minutes in.
  if (!OPENROUTER_API_KEY) {
    const reason = "OPENROUTER_API_KEY is not set in the Supabase Edge Function secrets";
    await markFailed(campaignId, log, reason);
    return json({ error: reason }, 500);
  }

  // Acknowledge now; the pipeline takes minutes and the caller cannot wait.
  const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
  const work = generate(campaignId, articleId, log);
  if (runtime?.waitUntil) {
    runtime.waitUntil(work);
  } else {
    // Older runtime without background tasks: run inline (the caller may time out,
    // but the campaign still completes and Realtime reports it).
    await work;
  }

  return json({ accepted: true, campaignId }, 202);
});
