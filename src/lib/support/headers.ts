/**
 * Email header helpers.
 *
 * Resend's received-email payload has changed shape before, and headers may
 * arrive as an array of { name, value } pairs, as a plain object, or not at
 * all. Everything downstream (spam scoring, threading) reads headers through
 * these helpers so a shape change degrades into "no headers" rather than a
 * crash or a silently wrong verdict.
 */

export type Headers = Record<string, string>;

/** Flatten any of the shapes Resend may send into a lowercase-keyed map. */
export function normalizeHeaders(raw: unknown): Headers {
    const out: Headers = {};
    if (!raw) return out;

    if (Array.isArray(raw)) {
        for (const h of raw) {
            if (!h || typeof h !== "object") continue;
            const name = (h as { name?: unknown }).name;
            const value = (h as { value?: unknown }).value;
            if (typeof name === "string") {
                const key = name.toLowerCase();
                // Repeated headers (Received, Authentication-Results) accumulate
                // newest-first; keep them all so the full chain stays inspectable.
                const v = value == null ? "" : String(value);
                out[key] = out[key] ? `${out[key]}\n${v}` : v;
            }
        }
        return out;
    }

    if (typeof raw === "object") {
        for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
            out[name.toLowerCase()] = value == null ? "" : String(value);
        }
    }

    return out;
}

export function header(headers: Headers, name: string): string {
    return headers[name.toLowerCase()] || "";
}

/**
 * Whether the header was actually present.
 *
 * Distinct from a non-empty value: `Return-Path: <>` means "this is a bounce",
 * while no Return-Path at all means "we don't know". Treating the two the same
 * quarantines every message that arrives without the header.
 */
export function hasHeader(headers: Headers, name: string): boolean {
    return Object.prototype.hasOwnProperty.call(headers, name.toLowerCase());
}

/** Strip the angle brackets and whitespace off a Message-ID. */
export function cleanMessageId(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const m = raw.match(/<([^>]+)>/);
    const id = (m ? m[1] : raw).trim();
    return id || null;
}

/** All Message-IDs referenced by a reply, oldest ancestor first. */
export function parseReferences(headers: Headers): string[] {
    const refs = `${header(headers, "references")} ${header(headers, "in-reply-to")}`;
    const ids = refs.match(/<[^>]+>/g) || [];
    return [...new Set(ids.map((id) => id.slice(1, -1).trim()).filter(Boolean))];
}

export function extractEmail(from: string): string {
    const match = from.match(/<([^>]+)>/);
    return (match ? match[1] : from).toLowerCase().trim();
}

export function extractName(from: string): string | null {
    const match = from.match(/^\s*"?([^"<]+?)"?\s*</);
    return match ? match[1].trim() || null : null;
}

export function emailDomain(email: string): string {
    return email.split("@").pop()?.toLowerCase().trim() || "";
}
