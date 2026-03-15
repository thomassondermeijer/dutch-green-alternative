import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/resend/client";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/support/reply
 * Sends a reply email to the customer and logs it.
 */
export async function POST(req: NextRequest) {
    try {
        const { ticketId, customerEmail, subject, bodyText } = await req.json();

        if (!ticketId || !customerEmail || !bodyText) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Send email via Resend
        const result = await sendEmail({
            to: customerEmail,
            subject: subject || "Re: Your inquiry",
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="white-space: pre-wrap; line-height: 1.6; color: #333;">${bodyText.replace(/\n/g, "<br>")}</div>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                    <div style="font-size: 12px; color: #9ca3af;">
                        Dutch Green Alternative<br />
                        <a href="https://dutchgreenalternative.nl" style="color: #2d5a3d;">dutchgreenalternative.nl</a>
                    </div>
                </div>
            `,
            replyTo: "info@dutchgreenalternative.nl",
        });

        // Log the message
        await supabaseAdmin.from("ticket_messages").insert({
            ticket_id: ticketId,
            direction: "outbound",
            from_email: "info@dutchgreenalternative.nl",
            body_text: bodyText,
            body_html: null,
            is_ai_generated: false,
            resend_id: result.id || null,
        });

        // Update ticket status to pending
        await supabaseAdmin.from("support_tickets").update({
            status: "pending",
            updated_at: new Date().toISOString(),
        }).eq("id", ticketId);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[Support Reply]", err);
        return NextResponse.json({ error: "Failed to send reply" }, { status: 500 });
    }
}
