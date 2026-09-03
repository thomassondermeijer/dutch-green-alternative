import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Webhook } from "svix";
import {
    normalizeHeaders,
    header,
    cleanMessageId,
    parseReferences,
    extractEmail,
    extractName,
    type Headers as MailHeaders,
} from "@/lib/support/headers";
import { classifyInbound, looksLikeUnsubscribe, honourUnsubscribe } from "@/lib/support/spam";
import { findThread, normalizeSubject } from "@/lib/support/threading";
import { sendAutoAcknowledgement } from "@/lib/support/auto-reply";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

/** Domains whose mail belongs in this inbox. Anything else is another tenant's. */
const OUR_INBOUND_DOMAINS = ["dutchgreenalternative.nl"];

/**
 * Language detection from common words, checking subject as well as body so
 * short messages still resolve.
 */
function detectLanguage(text: string, subject?: string, fromEmail?: string): string {
    const lower = `${subject || ""} ${text}`.toLowerCase();
    const deWords = ["und", "ich", "die", "der", "das", "ist", "nicht", "ein", "eine", "mit", "habe", "mein", "bestellung", "lieferung", "hallo", "bitte", "danke", "produkt", "produkte", "guten", "morgen", "schon", "nehme", "möchte", "gerne", "wie", "tropfen", "anwendung"];
    const nlWords = ["en", "ik", "de", "het", "een", "niet", "van", "dat", "mijn", "bestelling", "heb", "graag", "bedankt", "hallo", "alstublieft", "producten", "wil", "wild", "goedemorgen", "dank"];

    const matchWord = (w: string) => {
        const regex = new RegExp(`(?:^|\\s|[.,!?;:])${w}(?:$|\\s|[.,!?;:])`);
        return regex.test(lower);
    };

    const deCount = deWords.filter(matchWord).length;
    const nlCount = nlWords.filter(matchWord).length;
    if (deCount > nlCount && deCount >= 1) return "de";
    if (nlCount > deCount && nlCount >= 1) return "nl";
    if (deCount > 0 || nlCount > 0) return deCount >= nlCount ? "de" : "nl";

    if (fromEmail) {
        const tld = fromEmail.split(".").pop()?.toLowerCase();
        if (tld === "de" || tld === "at" || tld === "ch") return "de";
        if (tld === "nl" || tld === "be") return "nl";
    }

    return "en";
}

/**
 * Fetch the full received email from Resend, with retries for the race where
 * the webhook lands before the body is queryable.
 * Received mail uses /emails/receiving/{id}, not /emails/{id}.
 */
async function fetchReceivedEmail(emailId: string, maxRetries = 3): Promise<Record<string, unknown> | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, 2000));

        try {
            const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
                headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
            });

            if (!res.ok) {
                const errBody = await res.text().catch(() => "(no body)");
                console.error(`[Inbound] Attempt ${attempt}/${maxRetries} — Failed to fetch ${emailId}: ${res.status} — ${errBody}`);
                continue;
            }

            const data = await res.json();
            if (data && (data.text || data.html || data.headers)) {
                console.log(`[Inbound] Fetched email on attempt ${attempt}/${maxRetries} for ${emailId}`);
                return data;
            }
            console.warn(`[Inbound] Attempt ${attempt}/${maxRetries} — ${emailId} fetched but empty, retrying...`);
        } catch (err) {
            console.error(`[Inbound] Attempt ${attempt}/${maxRetries} — Network error for ${emailId}:`, err);
        }
    }

    console.error(`[Inbound] All ${maxRetries} attempts failed for ${emailId}`);
    return null;
}

const parseAddr = (raw: unknown): string => {
    const s = typeof raw === "string" ? raw : String((raw as { email?: string })?.email ?? raw ?? "");
    const m = s.match(/<([^>]+)>/);
    return (m ? m[1] : s).trim().toLowerCase();
};
const toArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v ? [v] : []);

/**
 * POST /api/webhooks/inbound
 * Receives Resend `email.received` events and files them as support tickets.
 *
 * Pipeline: verify signature → check the mail is addressed to us → fetch the
 * body and headers → classify (spam cascade) → thread → store → auto-reply.
 */
export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text();

        // ── Webhook signature verification (Svix / Resend) ──
        // Authenticates that the event genuinely came from Resend, so this endpoint
        // can't be used to forge support tickets. Enforced only when the inbound
        // webhook's signing secret is configured, so deploying before the env var is
        // set never breaks the support inbox.
        const webhookSecret = process.env.DGA_RESEND_INBOUND_WEBHOOK_SECRET || "";
        if (webhookSecret) {
            try {
                new Webhook(webhookSecret).verify(rawBody, {
                    "svix-id": req.headers.get("svix-id") || "",
                    "svix-timestamp": req.headers.get("svix-timestamp") || "",
                    "svix-signature": req.headers.get("svix-signature") || "",
                });
            } catch (err) {
                console.warn("[Inbound] Rejected webhook — invalid signature:", err instanceof Error ? err.message : err);
                return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
            }
        } else {
            console.warn("[Inbound] DGA_RESEND_INBOUND_WEBHOOK_SECRET not set — skipping signature verification.");
        }

        const body = JSON.parse(rawBody);

        let from: string;
        let emailSubject: string;
        let bodyText = "";
        let bodyHtml = "";
        let resendEmailId: string | null = null;
        let mailHeaders: MailHeaders = {};

        if (body.type === "email.received" && body.data) {
            const { data } = body;

            // ── Recipient tenancy guard ──
            // Resend webhooks are ACCOUNT-scoped, not domain-scoped: this endpoint
            // also receives email.received events for sibling domains on the shared
            // Resend account. Drop anything not addressed to a DGA-owned domain so we
            // don't create cross-tenant tickets. Runs before any fetch or DB write.
            const allRecipients = [
                ...toArray(data.to),
                ...toArray(data.cc),
                ...toArray(data.bcc),
            ].map(parseAddr).filter(Boolean);

            if (allRecipients.length === 0) {
                console.warn(`[Inbound] email.received had no parseable recipients; processing anyway. data keys: ${Object.keys(data).join(", ")}`);
            } else {
                const forUs = allRecipients.some((addr) =>
                    OUR_INBOUND_DOMAINS.some((d) => addr.endsWith(`@${d}`))
                );
                if (!forUs) {
                    console.log(`[Inbound] Dropping cross-tenant mail; recipients=${allRecipients.join(",")}`);
                    return NextResponse.json({ received: true, ignored: true, reason: "not_our_domain" });
                }
            }

            from = data.from || "";
            emailSubject = data.subject || "(No Subject)";
            resendEmailId = data.email_id || data.id || null;
            mailHeaders = normalizeHeaders(data.headers);

            // Seed from the webhook payload when it carries the body. The API
            // fetch below overrides with the fuller record, but without this the
            // whole pipeline — spam scoring, language detection, the stored
            // message — runs on an empty body whenever the fetch can't happen.
            bodyText = (data.text as string) || "";
            bodyHtml = (data.html as string) || "";

            if (resendEmailId && RESEND_API_KEY) {
                const fullEmail = await fetchReceivedEmail(resendEmailId);
                if (fullEmail) {
                    // Only overwrite when the fetch actually returned content —
                    // an empty record must not wipe what the payload gave us.
                    if (fullEmail.text) bodyText = fullEmail.text as string;
                    if (fullEmail.html) bodyHtml = fullEmail.html as string;
                    if (fullEmail.from) from = fullEmail.from as string;
                    // Headers from the full record win — the webhook payload often omits them.
                    const fetched = normalizeHeaders(fullEmail.headers);
                    if (Object.keys(fetched).length > 0) mailHeaders = fetched;
                } else {
                    console.error(`[Inbound] Could not fetch body for ${resendEmailId} — will be fetched on demand`);
                }
            } else {
                console.error(`[Inbound] Cannot fetch body: resendEmailId=${resendEmailId}, key present=${!!RESEND_API_KEY}`);
            }
        } else if (body.from) {
            // Legacy direct payload format (fallback)
            from = body.from;
            emailSubject = body.subject || "(No Subject)";
            bodyText = body.text || "";
            bodyHtml = body.html || "";
            mailHeaders = normalizeHeaders(body.headers);
        } else {
            return NextResponse.json({ ok: true, skipped: "unrecognized payload" });
        }

        if (!from) {
            return NextResponse.json({ error: "Missing 'from'" }, { status: 400 });
        }

        const customerEmail = extractEmail(from);
        const customerName = extractName(from);
        const language = detectLanguage(bodyText, emailSubject, customerEmail);
        const normalizedSubject = normalizeSubject(emailSubject) || "(No Subject)";

        const messageId = cleanMessageId(header(mailHeaders, "message-id"));
        const inReplyTo = cleanMessageId(header(mailHeaders, "in-reply-to"));
        const references = parseReferences(mailHeaders);

        // ── Idempotency: Resend retries webhooks, and a retry must not duplicate. ──
        if (messageId) {
            const { data: seen } = await supabaseAdmin
                .from("ticket_messages")
                .select("id, ticket_id")
                .eq("message_id", messageId)
                .limit(1);
            if (seen?.length) {
                console.log(`[Inbound] Duplicate delivery of ${messageId} — ignoring`);
                return NextResponse.json({ success: true, duplicate: true, ticket_id: seen[0].ticket_id });
            }
        }

        // ── Spam cascade ──
        const verdict = await classifyInbound({
            fromEmail: customerEmail,
            fromName: customerName,
            subject: emailSubject,
            bodyText,
            bodyHtml,
            headers: mailHeaders,
        });
        console.log(`[Inbound] ${customerEmail} — spam=${verdict.isSpam} score=${verdict.score ?? "n/a"} reasons=${verdict.reasons.join("|")}`);

        // ── Threading ──
        // Spam never joins an existing thread; it would drag quarantined mail
        // into a real customer's conversation.
        const thread = verdict.isSpam
            ? { ticketId: "", via: "none" as const }
            : await findThread(customerEmail, emailSubject, [...references, ...(inReplyTo ? [inReplyTo] : [])]);

        let ticketId = thread.ticketId;
        let isNewTicket = false;

        if (!ticketId) {
            isNewTicket = true;

            // Link the customer's most recent order for context, but only for
            // mail we're actually going to work.
            let orderId: string | null = null;
            if (!verdict.isSpam) {
                const { data: order } = await supabaseAdmin
                    .from("orders")
                    .select("id")
                    .ilike("customer_email", customerEmail)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (order) orderId = order.id;
            }

            const { data: newTicket, error: insertErr } = await supabaseAdmin
                .from("support_tickets")
                .insert({
                    subject: normalizedSubject,
                    customer_email: customerEmail,
                    customer_name: customerName,
                    language,
                    order_id: orderId,
                    status: "open",
                    priority: "normal",
                    is_spam: verdict.isSpam,
                    spam_score: verdict.score,
                    spam_reasons: verdict.reasons,
                    spam_checked_at: new Date().toISOString(),
                    quarantined_at: verdict.isSpam ? new Date().toISOString() : null,
                })
                .select("id")
                .single();

            if (insertErr || !newTicket) {
                console.error("[Inbound] Failed to create ticket:", insertErr);
                return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
            }
            ticketId = newTicket.id;
        } else {
            await supabaseAdmin
                .from("support_tickets")
                .update({ status: "open", updated_at: new Date().toISOString() })
                .eq("id", ticketId);
        }

        // ── Store the message ──
        await supabaseAdmin.from("ticket_messages").insert({
            ticket_id: ticketId,
            direction: "inbound",
            from_email: customerEmail,
            author_email: customerEmail,
            body_text: bodyText,
            body_html: bodyHtml,
            message_id: messageId,
            in_reply_to: inReplyTo,
            email_references: references.length ? references.join(" ") : null,
            raw_headers: Object.keys(mailHeaders).length ? mailHeaders : null,
            ...(resendEmailId ? { resend_email_id: resendEmailId } : {}),
        });

        // ── Unsubscribe requests carry a legal deadline: honour immediately. ──
        if (!verdict.isSpam && looksLikeUnsubscribe(emailSubject, bodyText)) {
            const recorded = await honourUnsubscribe(customerEmail, `support_ticket:${ticketId}`);
            if (recorded) {
                await supabaseAdmin
                    .from("support_tickets")
                    .update({ priority: "high" })
                    .eq("id", ticketId);
                await supabaseAdmin.from("ticket_messages").insert({
                    ticket_id: ticketId,
                    direction: "outbound",
                    from_email: "system@dutchgreenalternative.nl",
                    author_email: "system",
                    is_internal_note: true,
                    body_text:
                        "Unsubscribe request detected — this address was added to the marketing suppression list automatically. Confirm with the customer that nothing further is needed.",
                });
            }
        }

        // ── Auto-acknowledge genuine first contact ──
        // Never for quarantined mail, never on a reply into an existing thread,
        // and never to an automated sender (the hard rules already caught those).
        if (!verdict.isSpam && isNewTicket) {
            await sendAutoAcknowledgement({
                ticketId,
                to: customerEmail,
                customerName,
                subject: normalizedSubject,
                language,
                inReplyTo: messageId,
            });
        }

        console.log(`[Inbound] Ticket ${ticketId} — ${isNewTicket ? "new" : `threaded via ${thread.via}`}, body ${bodyText.length} chars`);
        return NextResponse.json({
            success: true,
            ticket_id: ticketId,
            is_spam: verdict.isSpam,
            threaded_via: thread.via,
        });
    } catch (err) {
        console.error("[Inbound] Error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
