import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Simple language detection based on common words.
 * Returns 'de', 'nl', or 'en'.
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

/**
 * Extract name from email "From" field.
 * e.g. "John Doe <john@example.com>" → "John Doe"
 */
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
 * POST /api/webhooks/inbound
 * Receives inbound emails from Resend.
 *
 * Expected payload from Resend:
 * {
 *   from: "John <john@example.com>",
 *   to: "support@dutchgreenalternative.nl",
 *   subject: "Question about my order",
 *   text: "Plain text body",
 *   html: "<p>HTML body</p>"
 * }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { from, subject, text, html } = body;

        if (!from) {
            return NextResponse.json({ error: "Missing 'from'" }, { status: 400 });
        }

        const customerEmail = extractEmail(from);
        const customerName = extractName(from);
        const bodyText = text || "";
        const bodyHtml = html || "";
        const emailSubject = subject || "(No Subject)";
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

        // Match by subject similarity (strip Re:/Fwd: prefixes)
        let ticketId: string | null = null;
        if (existingTickets && existingTickets.length > 0) {
            // Check if any existing ticket subject matches
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
            // If no subject match, use the most recent open ticket from this customer
            if (!ticketId) {
                ticketId = existingTickets[0].id;
            }
        }

        // If no existing ticket, create a new one
        if (!ticketId) {
            // Try to link to customer's most recent order
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
            // Reopen if it was pending, and update timestamp
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
