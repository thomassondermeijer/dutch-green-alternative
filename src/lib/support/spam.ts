import { createClient } from "@supabase/supabase-js";
import { Headers, header, hasHeader, emailDomain } from "./headers";
import classifierPrompt from "./classifier-prompt.json";
import { chatJson, isConfigured, MODELS } from "@/lib/ai/openrouter";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Domains we send from. Mail claiming to be from us is a loop, not a customer. */
export const OUR_DOMAINS = [
    "dutchgreenalternative.nl",
    "dutchgreenalternative.zendesk.com",
];

export type SpamVerdict = {
    isSpam: boolean;
    /** SpamAssassin score when the content check ran, otherwise null. */
    score: number | null;
    /** Machine-readable reason codes, shown on the ticket so a wrong call is diagnosable. */
    reasons: string[];
};

export type InboundMail = {
    fromEmail: string;
    fromName: string | null;
    subject: string;
    bodyText: string;
    bodyHtml: string;
    headers: Headers;
};

// ─────────────────────────────────────────────────────────────────────────────
// Layer 0 — allowlist. Runs first so an aggressive filter can never lose a
// real customer: anyone who has ordered, or who we have replied to before,
// always reaches the inbox regardless of what the later layers think.
// ─────────────────────────────────────────────────────────────────────────────

export async function isKnownCustomer(email: string): Promise<boolean> {
    const domain = emailDomain(email);

    const [allow, order, customer, ticket] = await Promise.all([
        supabaseAdmin
            .from("support_allowlist")
            .select("id")
            .or(`and(kind.eq.email,value.ilike.${email}),and(kind.eq.domain,value.ilike.${domain})`)
            .limit(1),
        supabaseAdmin
            .from("orders")
            .select("id")
            .ilike("customer_email", email)
            .limit(1),
        // Registered accounts and newsletter subscribers count too. Several
        // real customers here have an account but have not ordered yet, and
        // checking orders alone quarantined their newsletter replies.
        supabaseAdmin
            .from("customers")
            .select("id")
            .ilike("email", email)
            .limit(1),
        // A ticket a human actually replied to is proof the sender is real.
        // Auto-acknowledgements are excluded — otherwise the filter would
        // allowlist every address it ever machine-replied to, including spam.
        supabaseAdmin
            .from("support_tickets")
            .select("id, ticket_messages!inner(id)")
            .ilike("customer_email", email)
            .eq("is_spam", false)
            .eq("ticket_messages.direction", "outbound")
            .eq("ticket_messages.is_auto_reply", false)
            .eq("ticket_messages.is_internal_note", false)
            .limit(1),
    ]);

    return Boolean(
        allow.data?.length || order.data?.length || customer.data?.length || ticket.data?.length
    );
}

async function isBlocklisted(email: string): Promise<string | null> {
    const domain = emailDomain(email);
    const { data } = await supabaseAdmin
        .from("support_blocklist")
        .select("kind, value")
        .or(`and(kind.eq.email,value.ilike.${email}),and(kind.eq.domain,value.ilike.${domain})`)
        .limit(1);

    if (!data?.length) return null;
    return data[0].kind === "domain" ? "blocklist_domain" : "blocklist_sender";
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 1 — hard rules. Cheap, header-only, no false positives worth worrying
// about: none of these are ever a customer writing in.
// ─────────────────────────────────────────────────────────────────────────────

const NOREPLY_LOCAL_PARTS = [
    "noreply", "no-reply", "no_reply", "donotreply", "do-not-reply",
    "mailer-daemon", "postmaster", "bounce", "bounces", "notifications",
    "notification", "no.reply",
];

export function hardRuleReasons(mail: InboundMail): string[] {
    const reasons: string[] = [];
    const h = mail.headers;
    const localPart = mail.fromEmail.split("@")[0]?.toLowerCase() || "";
    const domain = emailDomain(mail.fromEmail);

    // Automated mail must never receive an auto-reply — that is how loops start.
    const autoSubmitted = header(h, "auto-submitted").toLowerCase();
    if (autoSubmitted && autoSubmitted !== "no") reasons.push("auto_submitted");

    const precedence = header(h, "precedence").toLowerCase();
    if (["bulk", "junk", "list", "auto_reply"].some((p) => precedence.includes(p))) {
        reasons.push("bulk_precedence");
    }

    if (header(h, "x-auto-response-suppress")) reasons.push("auto_response_suppress");
    if (header(h, "list-unsubscribe") || header(h, "list-id")) reasons.push("bulk_mailing_list");
    if (header(h, "x-autoreply") || header(h, "x-autorespond")) reasons.push("autoresponder");

    // A null Return-Path (`<>`) or a multipart/report body is a delivery status
    // notification. The header being absent entirely says nothing — checking
    // only the value quarantined every message that arrived without one.
    if (hasHeader(h, "return-path") && header(h, "return-path").replace(/[<>\s]/g, "") === "") {
        reasons.push("null_return_path");
    }
    if (header(h, "content-type").toLowerCase().includes("multipart/report")) reasons.push("bounce_dsn");

    if (NOREPLY_LOCAL_PARTS.some((p) => localPart === p || localPart.startsWith(`${p}+`) || localPart.startsWith(`${p}-`))) {
        reasons.push("noreply_sender");
    }

    // Mail claiming to come from us: either a loop or a spoof. Both go to quarantine.
    if (OUR_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
        reasons.push("mail_loop_own_domain");
    }

    // "Re: Re: Re: Re: Re:" is two auto-responders talking to each other.
    const nesting = (mail.subject.match(/\b(re|aw|fw|fwd|antw)\s*:/gi) || []).length;
    if (nesting >= 4) reasons.push("subject_loop_nesting");

    // Upstream filters sometimes tag before we see it.
    if (/\[(possible)?spam\]/i.test(mail.subject) || header(h, "x-spam-flag").toLowerCase() === "yes") {
        reasons.push("upstream_spam_flag");
    }

    return reasons;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2 — sender authentication. The phishing in this inbox impersonates
// PostNL, Kraken, ChatGPT and Hostinger; all of it fails DMARC.
// ─────────────────────────────────────────────────────────────────────────────

export function authFailureReasons(headers: Headers): string[] {
    const results = header(headers, "authentication-results").toLowerCase();
    if (!results) return [];

    const reasons: string[] = [];
    if (/dmarc=(fail|permerror|temperror)/.test(results)) reasons.push("dmarc_fail");
    if (/spf=(fail|softfail)/.test(results)) reasons.push("spf_fail");
    if (/dkim=(fail|permerror)/.test(results)) reasons.push("dkim_fail");
    return reasons;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 3 — Postmark's public SpamCheck endpoint: SpamAssassin as a free,
// keyless API. Catches classic bulk spam and link farms.
// ─────────────────────────────────────────────────────────────────────────────

/** Rebuild enough of an RFC 822 message for SpamAssassin to score. */
function toRfc822(mail: InboundMail): string {
    const keep = ["from", "to", "subject", "date", "content-type", "reply-to", "return-path", "received", "message-id"];
    const lines: string[] = [];

    for (const name of keep) {
        const value = header(mail.headers, name);
        if (value) {
            for (const v of value.split("\n")) lines.push(`${name}: ${v}`);
        }
    }
    // Guarantee the essentials even when no headers came through.
    if (!header(mail.headers, "from")) lines.push(`From: ${mail.fromEmail}`);
    if (!header(mail.headers, "subject")) lines.push(`Subject: ${mail.subject}`);

    const body = mail.bodyText || mail.bodyHtml.replace(/<[^>]+>/g, " ");
    return `${lines.join("\n")}\n\n${body.slice(0, 40_000)}`;
}

export async function spamAssassinScore(mail: InboundMail): Promise<number | null> {
    try {
        const res = await fetch("https://spamcheck.postmarkapp.com/filter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: toRfc822(mail), options: "short" }),
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
            console.warn(`[spam] SpamCheck returned ${res.status}`);
            return null;
        }
        const data = await res.json();
        if (!data?.success) return null;
        const score = Number(data.score);
        return Number.isFinite(score) ? score : null;
    } catch (err) {
        // The filter must never block inbound mail on a third party being down.
        console.warn("[spam] SpamCheck unavailable:", err instanceof Error ? err.message : err);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 4 — LLM classifier for the gray zone. SpamAssassin scores Dutch and
// German cold outreach low; this is what actually catches it.
// ─────────────────────────────────────────────────────────────────────────────

export type MailCategory =
    | "customer"
    | "spam_or_phishing"
    | "cold_outreach"
    | "vendor_notification"
    | "other_business";

const CLASSIFIER_PROMPT = classifierPrompt.prompt;

export async function classifyWithLlm(
    mail: InboundMail
): Promise<{ category: MailCategory; confidence: number; reason: string } | null> {
    if (!isConfigured()) return null;

    const body = (mail.bodyText || mail.bodyHtml.replace(/<[^>]+>/g, " ")).slice(0, 4000);

    const parsed = await chatJson<{ category?: string; confidence?: unknown; reason?: unknown }>({
        model: MODELS.CLASSIFY,
        system: CLASSIFIER_PROMPT,
        prompt: `FROM: ${mail.fromName ? `${mail.fromName} ` : ""}<${mail.fromEmail}>
SUBJECT: ${mail.subject}

BODY:
${body}`,
        temperature: 0,
        maxTokens: 700,
        timeoutMs: 15_000,
    });

    if (!parsed) return null;

    const valid: MailCategory[] = [
        "customer", "spam_or_phishing", "cold_outreach", "vendor_notification", "other_business",
    ];
    if (!valid.includes(parsed.category as MailCategory)) return null;

    return {
        category: parsed.category as MailCategory,
        confidence: Number(parsed.confidence) || 0,
        reason: String(parsed.reason || "").slice(0, 80),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// The cascade. Stops as soon as a layer decides, so the expensive checks only
// run on mail that the cheap ones could not settle.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SpamAssassin thresholds.
 *
 * A score alone is not allowed to quarantine anything in the 5–8 band: this is
 * a Dutch/German inbox selling a CBD product, and SpamAssassin scores ordinary
 * customer mail about it above 5 on keywords alone. Real replies to our own
 * newsletter landed at 5.3. Only a decisively high score acts on its own;
 * everything below it goes to the classifier, and if the classifier is
 * unavailable the mail reaches a human.
 */
const SPAMASSASSIN_DECISIVE = 8.0;
const SPAMASSASSIN_SUSPICIOUS = 5.0;

export async function classifyInbound(mail: InboundMail): Promise<SpamVerdict> {
    // 0. Known customers bypass everything.
    if (await isKnownCustomer(mail.fromEmail)) {
        return { isSpam: false, score: null, reasons: ["allowlisted_customer"] };
    }

    // 0b. Explicitly blocked senders.
    const blocked = await isBlocklisted(mail.fromEmail);
    if (blocked) return { isSpam: true, score: null, reasons: [blocked] };

    // 1. Hard rules — automated mail, loops, bounces.
    const hard = hardRuleReasons(mail);
    if (hard.length > 0) return { isSpam: true, score: null, reasons: hard };

    const reasons: string[] = [];

    // 2. Sender authentication.
    const authFails = authFailureReasons(mail.headers);
    reasons.push(...authFails);
    if (authFails.includes("dmarc_fail")) {
        // DMARC failure from an unknown sender is decisive on its own.
        return { isSpam: true, score: null, reasons };
    }

    // 3. SpamAssassin content score. Decisive only when very high.
    const score = await spamAssassinScore(mail);
    if (score !== null && score >= SPAMASSASSIN_DECISIVE) {
        reasons.push(`spamassassin_${score.toFixed(1)}`);
        return { isSpam: true, score, reasons };
    }
    const suspicious = score !== null && score >= SPAMASSASSIN_SUSPICIOUS;

    // 4. The gray zone — localised outreach and phishing SpamAssassin scores
    // low, and ordinary CBD questions it scores high.
    const llm = await classifyWithLlm(mail);
    if (llm) {
        reasons.push(`llm_${llm.category}${llm.reason ? `: ${llm.reason}` : ""}`);
        const quarantine: MailCategory[] = [
            "spam_or_phishing", "cold_outreach", "vendor_notification", "other_business",
        ];
        // A middling SpamAssassin score lowers the confidence the classifier
        // needs; on its own it never decides anything.
        const needed = suspicious ? 0.6 : 0.75;
        if (quarantine.includes(llm.category) && llm.confidence >= needed) {
            if (suspicious) reasons.push(`spamassassin_${score.toFixed(1)}`);
            return { isSpam: true, score, reasons };
        }
    } else if (suspicious) {
        // Classifier unavailable and the score is only suspicious: fail open.
        // A missed spam costs one click; a quarantined customer costs a sale.
        reasons.push(`spamassassin_unconfirmed_${score.toFixed(1)}`);
    }

    if (reasons.length === 0) reasons.push("clean");
    return { isSpam: false, score, reasons };
}

// ─────────────────────────────────────────────────────────────────────────────
// Unsubscribe requests. These arrive as ordinary support mail but carry a
// legal deadline, so they are detected on arrival and honoured immediately.
// ─────────────────────────────────────────────────────────────────────────────

const UNSUBSCRIBE_PATTERNS = [
    /\babmeld(en|ung|et)\b/i,
    /\baustragen\b/i,
    /\bkeine\s+(weiteren\s+)?(e-?mails?|newsletter|werbung)\b/i,
    /\buitschrijven\b/i,
    /\bafmeld(en|ing)\b/i,
    /\bgeen\s+(nieuwsbrief|nieuwsbrieven|mails?|e-?mails?)\s+meer\b/i,
    /\bunsubscribe\b/i,
    /\bopt[-\s]?out\b/i,
    /\bremove\s+me\s+from\b/i,
    /\bstop\s+(sending|these)\s+(me\s+)?(e-?mails?|newsletters?)\b/i,
];

export function looksLikeUnsubscribe(subject: string, bodyText: string): boolean {
    const haystack = `${subject}\n${bodyText}`.slice(0, 2000);
    return UNSUBSCRIBE_PATTERNS.some((re) => re.test(haystack));
}

/**
 * Honour an unsubscribe request by writing to the marketing suppression list.
 * Idempotent — a repeated request is a no-op rather than a duplicate row.
 */
export async function honourUnsubscribe(email: string, source: string): Promise<boolean> {
    const { data: existing } = await supabaseAdmin
        .from("email_suppression")
        .select("id")
        .ilike("email", email)
        .eq("reason", "unsubscribed")
        .limit(1);

    if (existing?.length) return false;

    const { error } = await supabaseAdmin
        .from("email_suppression")
        .insert({ email: email.toLowerCase(), reason: "unsubscribed", source });

    if (error) {
        console.error("[spam] Failed to record unsubscribe:", error);
        return false;
    }
    console.log(`[spam] Honoured unsubscribe request from ${email}`);
    return true;
}
