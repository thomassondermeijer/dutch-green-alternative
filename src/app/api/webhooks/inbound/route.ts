import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

/**
 * Simple language detection based on common words.
 * Checks both body text and subject for robustness with short messages.
 */
function detectLanguage(text: string, subject?: string, fromEmail?: string): string {
    const lower = `${subject || ""} ${text}`.toLowerCase();
    const deWords = ["und", "ich", "die", "der", "das", "ist", "nicht", "ein", "eine", "mit", "habe", "mein", "bestellung", "lieferung", "hallo", "bitte", "danke", "produkt", "produkte", "guten", "morgen", "schon", "nehme", "möchte", "gerne", "wie", "tropfen", "anwendung"];
    const nlWords = ["en", "ik", "de", "het", "een", "niet", "van", "dat", "mijn", "bestelling", "heb", "graag", "bedankt", "hallo", "alstublieft", "producten", "wil", "wild", "goedemorgen", "dank"];

    // Use word boundary matching that works for single words and phrases
    const matchWord = (w: string) => {
        const regex = new RegExp(`(?:^|\\s|[.,!?;:])${w}(?:$|\\s|[.,!?;:])`);
        return regex.test(lower);
    };

    const deCount = deWords.filter(matchWord).length;
    const nlCount = nlWords.filter(matchWord).length;
    if (deCount > nlCount && deCount >= 1) return "de";
    if (nlCount > deCount && nlCount >= 1) return "nl";
    if (deCount > 0 || nlCount > 0) return deCount >= nlCount ? "de" : "nl";

    // Fallback: use email TLD as hint
    if (fromEmail) {
        const tld = fromEmail.split(".").pop()?.toLowerCase();
        if (tld === "de" || tld === "at" || tld === "ch") return "de";
        if (tld === "nl" || tld === "be") return "nl";
    }

    return "en";
}

function extractName(from: string): string | null {
    const match = from.match(/^([^<]+)\s*</);
    if (match) return match[1].trim();
    return null;
}

function extractEmail(from: string): string {
    const match = from.match(/<([^>]+)>/);
    if (match) return match[1].toLowerCase();
    return from.toLowerCase().trim();
}

/**
 * Fetch the full received email from Resend API with retry logic.
 * Note: Received emails use /emails/received/{id}, NOT /emails/{id} (which is for sent emails).
 * Retries with delay to handle race conditions where the email isn't immediately available.
 */
async function fetchReceivedEmail(emailId: string, maxRetries = 3): Promise<Record<string, unknown> | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        // Wait before retrying (skip delay on first attempt)
        if (attempt > 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        try {
            const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
                headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
            });

            if (!res.ok) {
                const errBody = await res.text().catch(() => "(no body)");
                console.error(`[Inbound] Attempt ${attempt}/${maxRetries} — Failed to fetch received email ${emailId}: ${res.status} — ${errBody}`);
                continue;
            }

            const data = await res.json();

            // Verify we actually got body content
            if (data && (data.text || data.html)) {
                console.log(`[Inbound] Successfully fetched email body on attempt ${attempt}/${maxRetries} for ${emailId}`);
                return data;
            }

            console.warn(`[Inbound] Attempt ${attempt}/${maxRetries} — Email ${emailId} fetched but body is empty, retrying...`);
        } catch (err) {
            console.error(`[Inbound] Attempt ${attempt}/${maxRetries} — Network error fetching email ${emailId}:`, err);
        }
    }

    console.error(`[Inbound] All ${maxRetries} attempts failed to fetch email body for ${emailId}`);
    return null;
}

/**
 * POST /api/webhooks/inbound
 * Receives Resend webhook events for email.received.
 *
 * Resend sends: { type: "email.received", data: { email_id, from, to, subject, created_at } }
 * We then fetch the full email body via the Resend API.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Handle Resend webhook format: { type: "email.received", data: { ... } }
        let from: string;
        let emailSubject: string;
        let bodyText = "";
        let bodyHtml = "";
        let resendEmailId: string | null = null;

        if (body.type === "email.received" && body.data) {
            // Resend webhook event format
            const { data } = body;
            console.log(`[Inbound] Webhook payload data keys: ${Object.keys(data).join(", ")}`);
            console.log(`[Inbound] Webhook data:`, JSON.stringify({ email_id: data.email_id, id: data.id, from: data.from, subject: data.subject }));

            from = data.from || "";
            emailSubject = data.subject || "(No Subject)";

            // Try both possible field names for the email ID
            resendEmailId = data.email_id || data.id || null;

            // Fetch full email content from Resend API
            if (resendEmailId && RESEND_API_KEY) {
                console.log(`[Inbound] Fetching email body for ${resendEmailId}, API key length: ${RESEND_API_KEY.length}`);
                const fullEmail = await fetchReceivedEmail(resendEmailId);
                if (fullEmail) {
                    bodyText = (fullEmail.text as string) || "";
                    bodyHtml = (fullEmail.html as string) || "";
                    console.log(`[Inbound] Body fetched: text=${bodyText.length} chars, html=${bodyHtml.length} chars`);
                    // Use the full from field if available
                    if (fullEmail.from) from = fullEmail.from as string;
                } else {
                    console.error(`[Inbound] Could not fetch body for email ${resendEmailId} after retries — will be fetched on-demand when admin opens ticket`);
                }
            } else {
                console.error(`[Inbound] Cannot fetch body: resendEmailId=${resendEmailId}, RESEND_API_KEY present=${!!RESEND_API_KEY}, RESEND_API_KEY length=${RESEND_API_KEY.length}`);
            }
        } else if (body.from) {
            // Legacy direct payload format (fallback)
            from = body.from;
            emailSubject = body.subject || "(No Subject)";
            bodyText = body.text || "";
            bodyHtml = body.html || "";
        } else {
            return NextResponse.json({ ok: true, skipped: "unrecognized payload" });
        }

        if (!from) {
            return NextResponse.json({ error: "Missing 'from'" }, { status: 400 });
        }

        const customerEmail = extractEmail(from);
        const customerName = extractName(from);
        const language = detectLanguage(bodyText, emailSubject, customerEmail);

        // Try to find an existing open ticket from this customer with same subject
        const normalizedSubject = emailSubject.replace(/^(Re:|Fw:|Fwd:)\s*/gi, "").trim();
        const { data: existingTickets } = await supabaseAdmin
            .from("support_tickets")
            .select("id")
            .eq("customer_email", customerEmail)
            .in("status", ["open", "pending"])
            .order("updated_at", { ascending: false })
            .limit(5);

        // Match by subject similarity
        let ticketId: string | null = null;
        if (existingTickets && existingTickets.length > 0) {
            for (const t of existingTickets) {
                const { data: ticket } = await supabaseAdmin
                    .from("support_tickets")
                    .select("subject")
                    .eq("id", t.id)
                    .single();
                if (ticket) {
                    const existingNorm = ticket.subject.replace(/^(Re:|Fw:|Fwd:)\s*/gi, "").trim();
                    if (existingNorm.toLowerCase() === normalizedSubject.toLowerCase()) {
                        ticketId = t.id;
                        break;
                    }
                }
            }
            if (!ticketId) {
                ticketId = existingTickets[0].id;
            }
        }

        // If no existing ticket, create a new one
        if (!ticketId) {
            let orderId: string | null = null;
            const { data: order } = await supabaseAdmin
                .from("orders")
                .select("id")
                .eq("customer_email", customerEmail)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();
            if (order) orderId = order.id;

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
                })
                .select("id")
                .single();

            if (insertErr || !newTicket) {
                console.error("[Inbound Webhook] Failed to create ticket:", insertErr);
                return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
            }
            ticketId = newTicket.id;
        } else {
            await supabaseAdmin
                .from("support_tickets")
                .update({ status: "open", updated_at: new Date().toISOString() })
                .eq("id", ticketId);
        }

        // Insert the message
        await supabaseAdmin.from("ticket_messages").insert({
            ticket_id: ticketId,
            direction: "inbound",
            from_email: customerEmail,
            body_text: bodyText,
            body_html: bodyHtml,
            ...(resendEmailId ? { resend_email_id: resendEmailId } : {}),
        });

        console.log(`[Inbound] Ticket ${ticketId} — body stored: ${bodyText.length > 0 ? `${bodyText.length} chars` : "EMPTY"} — resend_id: ${resendEmailId || "none"}`);

        console.log(`[Inbound] Ticket ${ticketId} — from: ${customerEmail}, subject: ${emailSubject}`);
        return NextResponse.json({ success: true, ticket_id: ticketId });
    } catch (err) {
        console.error("[Inbound Webhook] Error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
