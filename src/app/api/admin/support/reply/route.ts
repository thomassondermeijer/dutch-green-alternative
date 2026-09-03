import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend/client";
import { getAdminEmail } from "@/lib/auth/admin";
import { supportDb } from "@/lib/support/db";
import { buildMessageId } from "@/lib/support/threading";

/**
 * POST /api/admin/support/reply
 * Sends a reply to the customer and logs it on the ticket.
 *
 * The recipient is read from the ticket rather than the request body — this
 * endpoint sends mail as info@dutchgreenalternative.nl, so letting the caller
 * name an arbitrary recipient would make it an open relay.
 */
export async function POST(req: NextRequest) {
    const admin = await getAdminEmail();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { ticketId, bodyText, isAiGenerated } = await req.json();

        if (!ticketId || typeof bodyText !== "string" || !bodyText.trim()) {
            return NextResponse.json({ error: "Missing ticketId or bodyText" }, { status: 400 });
        }

        const { data: ticket } = await supportDb
            .from("support_tickets")
            .select("id, subject, customer_email, first_replied_at")
            .eq("id", ticketId)
            .maybeSingle();

        if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

        // Thread the reply onto the customer's most recent message so it lands
        // in the same conversation in their mail client.
        const { data: lastInbound } = await supportDb
            .from("ticket_messages")
            .select("message_id")
            .eq("ticket_id", ticketId)
            .eq("direction", "inbound")
            .not("message_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        const messageId = buildMessageId(ticketId);
        const parentId = lastInbound?.message_id || null;

        const result = await sendEmail({
            to: ticket.customer_email,
            subject: /^re:/i.test(ticket.subject) ? ticket.subject : `Re: ${ticket.subject}`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="white-space: pre-wrap; line-height: 1.6; color: #333;">${escapeHtml(bodyText).replace(/\n/g, "<br>")}</div>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                    <div style="font-size: 12px; color: #9ca3af;">
                        Dutch Green Alternative<br />
                        <a href="https://dutchgreenalternative.nl" style="color: #2d5a3d;">dutchgreenalternative.nl</a>
                    </div>
                </div>
            `,
            replyTo: "info@dutchgreenalternative.nl",
            headers: {
                "Message-ID": `<${messageId}>`,
                ...(parentId ? { "In-Reply-To": `<${parentId}>`, References: `<${parentId}>` } : {}),
            },
        });

        if (!result.success) {
            console.error("[support/reply] Send failed:", result.error);
            return NextResponse.json({ error: "Failed to send reply" }, { status: 502 });
        }

        await supportDb.from("ticket_messages").insert({
            ticket_id: ticketId,
            direction: "outbound",
            from_email: "info@dutchgreenalternative.nl",
            author_email: admin,
            body_text: bodyText,
            body_html: null,
            is_ai_generated: Boolean(isAiGenerated),
            message_id: messageId,
            in_reply_to: parentId,
            resend_id: result.id || null,
        });

        await supportDb
            .from("support_tickets")
            .update({
                status: "pending",
                updated_at: new Date().toISOString(),
                ...(ticket.first_replied_at ? {} : { first_replied_at: new Date().toISOString() }),
            })
            .eq("id", ticketId);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[support/reply]", err);
        return NextResponse.json({ error: "Failed to send reply" }, { status: 500 });
    }
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
