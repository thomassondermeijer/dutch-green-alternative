/**
 * Where a marketing email is allowed to send people.
 *
 * The newsletter copy is written by a language model from a scraped source
 * article, and left to itself it cites that source — so every campaign so far
 * linked the BudMed Bulletin, a rival newsletter, and none ever linked the DGA
 * shop. Two things stop that: the prompt now supplies our own URLs as
 * placeholders, and `sanitizeCampaignLinks` below removes anything that points
 * somewhere we did not allow.
 *
 * Keep the host list in step with the copy inlined in
 * supabase/functions/marketing-generate/index.ts — Deno cannot import from here.
 */

const SITE = "https://dutchgreenalternative.nl";

/**
 * Registrable domains a marketing email may link to. Matching is by suffix, so
 * `nih.gov` covers `pubmed.ncbi.nlm.nih.gov` and `nature.com` covers `www.`.
 *
 * Newsletter platforms are deliberately absent: beehiiv, substack and the like
 * are where the source article lives, and linking them sends our readers to
 * someone else's list.
 */
export const ALLOWED_LINK_DOMAINS = [
    // Ours.
    "dutchgreenalternative.nl",

    // Research indexes and registries.
    "nih.gov",
    "doi.org",
    "clinicaltrials.gov",
    "who.int",
    "cochranelibrary.com",

    // Journals and academic publishers.
    "nature.com",
    "science.org",
    "sciencedirect.com",
    "elsevier.com",
    "thelancet.com",
    "bmj.com",
    "jamanetwork.com",
    "nejm.org",
    "cell.com",
    "pnas.org",
    "springer.com",
    "springeropen.com",
    "biomedcentral.com",
    "wiley.com",
    "tandfonline.com",
    "mdpi.com",
    "frontiersin.org",
    "plos.org",
    "oup.com",
    "sagepub.com",
    "ahajournals.org",
    "karger.com",
    "acs.org",
    "rsc.org",
] as const;

/** Placeholders the send step swaps for a real URL — never treated as links. */
const PLACEHOLDER_HREF = /^\{[A-Z_]+\}$/;

export function isAllowedLinkTarget(href: string): boolean {
    const value = href.trim();
    if (!value) return false;
    if (PLACEHOLDER_HREF.test(value)) return true;

    // mailto:, tel: and anchors are harmless and occasionally useful.
    if (/^(mailto:|tel:|#)/i.test(value)) return true;

    let host: string;
    try {
        host = new URL(value).hostname.toLowerCase();
    } catch {
        // Relative or malformed. Neither works in an email client, so it goes.
        return false;
    }

    return ALLOWED_LINK_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

export type SanitizeResult = {
    html: string;
    /** Hrefs that were unwrapped, for logging and for the admin to see. */
    removed: string[];
};

/**
 * Remove links to anywhere we have not allowed, keeping the words.
 *
 * Unwrapping rather than deleting matters: "published in the BudMed Bulletin"
 * still reads as a sentence once the anchor is gone, where deleting the whole
 * element would leave a hole mid-clause.
 *
 * This is a regex pass, not a DOM parse, because it has to run identically in
 * the Deno Edge Function. Email HTML from the model is flat and well-formed
 * enough for that; anything it cannot parse is left alone rather than mangled.
 */
export function sanitizeCampaignLinks(html: string): SanitizeResult {
    if (!html) return { html: "", removed: [] };

    const removed: string[] = [];

    const cleaned = html.replace(
        /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
        (whole, attrs: string, inner: string) => {
            const match = /href\s*=\s*["']([^"']*)["']/i.exec(attrs);
            const href = match ? match[1] : "";

            if (href && isAllowedLinkTarget(href)) return whole;

            removed.push(href || "(no href)");
            return inner;
        }
    );

    return { html: cleaned, removed };
}

// ─────────────────────────────────────────────────────────────────────────────
// URL builders — the app owns these, so the model never has to guess a domain
// or a path. It previously wrote dutchgreenalternative.com/products/<slug>,
// which is the wrong TLD and a 404 path.
// ─────────────────────────────────────────────────────────────────────────────

/** A product page, with the campaign coupon applied on arrival. */
export function productUrl(slug: string, locale: string, coupon?: string | null): string {
    const base = `${SITE}/${locale}/shop/${slug}`;
    return coupon ? `${base}?coupon=${encodeURIComponent(coupon)}` : base;
}

/** The whole range. */
export function shopUrl(locale: string, coupon?: string | null): string {
    const base = `${SITE}/${locale}/shop`;
    return coupon ? `${base}?coupon=${encodeURIComponent(coupon)}` : base;
}

/**
 * Fill the placeholders a campaign body carries.
 *
 * Shared by the send route and both preview surfaces so a placeholder can never
 * be handled in one and missed in another — which is how `{PRODUCT_URL}` would
 * otherwise reach a customer as literal text.
 */
export function renderCampaignBody(
    bodyHtml: string,
    opts: {
        firstName: string;
        discount: number | string;
        productSlug: string;
        locale: string;
        coupon?: string | null;
    }
): string {
    return (bodyHtml || "")
        .replace(/\{FIRST_NAME\}/g, opts.firstName)
        .replace(/\{DISCOUNT\}/g, String(opts.discount))
        .replace(/\{PRODUCT_URL\}/g, productUrl(opts.productSlug, opts.locale, opts.coupon))
        .replace(/\{SHOP_URL\}/g, shopUrl(opts.locale, opts.coupon));
}
