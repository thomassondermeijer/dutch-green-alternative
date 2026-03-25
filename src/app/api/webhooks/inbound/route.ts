import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

/**
 * Simple language detection based on common words.
 */
function detectLanguage(text: string): string {
    const lower = text.toLowerCase();
    const deWords = ["und", "ich", "die", "der", "das", "ist", "nicht", "ein", "eine", "mit", "habe", "mein", "bestellung", "lieferung"];
    const nlWords = ["en", "ik", "de", "het", "een", "niet", "van", "dat", "mijn", "bestelling", "heb", "graag", "bedankt"];
    const deCount = deWords.filter(w => lower.includes(` ${w} `) || lower.startsWith(`${w} `)).length;
    const nlCount = nlWords.filter(w => lower.includes(` ${w} `) || lower.startsWith(`${w} `)).length;
    if (deCount > nlCount && deCount > 2) return "de";
    if (nlCount > deCount && nlCount > 2) return "nl";
    if (deCount > 0 || nlCount > 0) return deCount >= nlCount ? "de" : "nl";
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
 * Fetch the full received email from Resend API.
 * Note: Received emails use /emails/received/{id}, NOT /emails/{id} (which is for sent emails).
 */
async function fetchReceivedEmail(emailId: string) {
    const res = await fetch(`https://api.resend.com/emails/received/${emailId}`, {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
    if (!res.ok) {
        console.error(`[Inbound] Failed to fetch received email ${emailId}: ${res.status}`);
        return null;
    }
    return res.json();
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

        if (body.type === "email.received" && body.data) {
            // Resend webhook event format
            const { data } = body;
            from = data.from || "";
            emailSubject = data.subject || "(No Subject)";

            // Fetch full email content from Resend API
            if (data.email_id && RESEND_API_KEY) {
                const fullEmail = await fetchReceivedEmail(data.email_id);
                if (fullEmail) {
                    bodyText = fullEmail.text || "";
                    bodyHtml = fullEmail.html || "";
                    // Use the full from field if available
                    if (fullEmail.from) from = fullEmail.from;
                }
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
        const language = detectLanguage(bodyText);

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
        });

        console.log(`[Inbound] Ticket ${ticketId} — from: ${customerEmail}, subject: ${emailSubject}`);
        return NextResponse.json({ success: true, ticket_id: ticketId });
    } catch (err) {
        console.error("[Inbound Webhook] Error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
