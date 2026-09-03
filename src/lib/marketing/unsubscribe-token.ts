import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed unsubscribe links.
 *
 * The link in a marketing email has to say which address it unsubscribes, and
 * that address is visible in the URL. Signing it stops anyone from editing the
 * address in the query string to unsubscribe somebody else — a real problem for
 * a competitor or a bored recipient, and the reason the link can't just be
 * `/unsubscribe?email=...`.
 *
 * The secret falls back to the service-role key so the feature works on any
 * environment that can already send mail. Set UNSUBSCRIBE_SECRET to rotate
 * tokens independently — note that rotating it invalidates the links in every
 * newsletter already sitting in people's inboxes, so those recipients fall back
 * to the confirmation page (which still works, it just asks them to confirm).
 */
function secret(): string {
    const value = process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!value) throw new Error("No UNSUBSCRIBE_SECRET or SUPABASE_SERVICE_ROLE_KEY configured");
    return value;
}

function normalize(email: string): string {
    return email.trim().toLowerCase();
}

export function signUnsubscribe(email: string): string {
    return createHmac("sha256", secret()).update(normalize(email)).digest("base64url");
}

/** Constant-time comparison — a fast reject leaks the signature a byte at a time. */
export function verifyUnsubscribe(email: string, token: string): boolean {
    if (!email || !token) return false;
    try {
        const expected = Buffer.from(signUnsubscribe(email));
        const given = Buffer.from(token);
        return expected.length === given.length && timingSafeEqual(expected, given);
    } catch {
        return false;
    }
}

/**
 * The link for a newsletter footer, and the same URL used in the
 * List-Unsubscribe header.
 */
export function unsubscribeUrl(email: string, locale = "de"): string {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://dutchgreenalternative.nl";
    const params = new URLSearchParams({ e: normalize(email), t: signUnsubscribe(email) });
    return `${base}/${locale}/unsubscribe?${params}`;
}

/** The RFC 8058 one-click endpoint — POSTed to directly by Gmail and Yahoo. */
export function oneClickUrl(email: string): string {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://dutchgreenalternative.nl";
    const params = new URLSearchParams({ e: normalize(email), t: signUnsubscribe(email) });
    return `${base}/api/unsubscribe?${params}`;
}

/**
 * The headers that put a native Unsubscribe button next to the sender name in
 * Gmail, Yahoo and Apple Mail. `List-Unsubscribe-Post` is what makes it
 * one-click (RFC 8058) rather than merely a link; without it the providers show
 * nothing. The mailto: arm is the fallback for older clients.
 */
export function unsubscribeHeaders(email: string, locale = "de"): Record<string, string> {
    return {
        "List-Unsubscribe": `<${oneClickUrl(email)}>, <mailto:unsubscribe@dutchgreenalternative.nl?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        // Not required, but it tells the receiving side this is a bulk send —
        // which is also what our own inbound filter keys on.
        Precedence: "bulk",
        "X-Unsubscribe-Web": unsubscribeUrl(email, locale),
    };
}
