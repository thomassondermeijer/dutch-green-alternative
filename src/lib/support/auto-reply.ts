import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/resend/client";
import { buildMessageId } from "./threading";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Copy = { subject: (s: string) => string; greeting: (n: string | null) => string; body: string; signoff: string };

const COPY: Record<string, Copy> = {
    nl: {
        subject: (s) => `Re: ${s}`,
        greeting: (n) => (n ? `Hallo ${n},` : "Hallo,"),
        body: "Bedankt voor je bericht. We hebben het ontvangen en reageren binnen één werkdag.\n\nHeb je een bestelling geplaatst? Vermeld dan je bestelnummer in je antwoord, dan kunnen we je sneller helpen.",
        signoff: "Met vriendelijke groet,\nDutch Green Alternative",
    },
    de: {
        subject: (s) => `Re: ${s}`,
        greeting: (n) => (n ? `Hallo ${n},` : "Hallo,"),
        body: "vielen Dank für Ihre Nachricht. Wir haben sie erhalten und melden uns innerhalb eines Werktages bei Ihnen.\n\nFalls es um eine Bestellung geht: Nennen Sie uns bitte Ihre Bestellnummer in Ihrer Antwort, dann können wir Ihnen schneller helfen.",
        signoff: "Mit freundlichen Grüßen,\nDutch Green Alternative",
    },
    en: {
        subject: (s) => `Re: ${s}`,
        greeting: (n) => (n ? `Hi ${n},` : "Hi,"),
        body: "Thanks for your message. We've received it and will reply within one working day.\n\nIf this is about an order, please include your order number in your reply so we can help you faster.",
        signoff: "Kind regards,\nDutch Green Alternative",
    },
};

function renderHtml(copy: Copy, name: string | null): string {
    const text = `${copy.greeting(name)}\n\n${copy.body}\n\n${copy.signoff}`;
    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="white-space: pre-wrap; line-height: 1.6; color: #333;">${text.replace(/\n/g, "<br>")}</div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <div style="font-size: 12px; color: #9ca3af;">
                Dutch Green Alternative<br />
                <a href="https://dutchgreenalternative.nl" style="color: #2d5a3d;">dutchgreenalternative.nl</a>
            </div>
        </div>
    `;
}

/**
 * Acknowledge genuine first contact.
 *
 * Only ever called for mail that cleared the spam cascade and opened a new
 * ticket — auto-replying to automated senders is how mail loops start. The
 * once-per-day guard is a second line of defence against backscatter if
 * someone forges a burst of mail from one address.
 */
export async function sendAutoAcknowledgement(opts: {
    ticketId: string;
    to: string;
    customerName: string | null;
    subject: string;
    language: string;
    /** The customer's Message-ID, so the acknowledgement threads under it. */
    inReplyTo: string | null;
}): Promise<boolean> {
    const { ticketId, to, customerName, subject, language, inReplyTo } = opts;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
        .from("ticket_messages")
        .select("id")
        .eq("is_auto_reply", true)
        .ilike("from_email", to)
        .gte("created_at", since)
        .limit(1);

    if (recent?.length) {
        console.log(`[auto-reply] Already acknowledged ${to} in the last 24h — skipping`);
        return false;
    }

    const copy = COPY[language] || COPY.en;
    const messageId = buildMessageId(ticketId);
    const firstName = customerName?.split(/\s+/)[0] || null;

    const result = await sendEmail({
        to,
        subject: copy.subject(subject),
        html: renderHtml(copy, firstName),
        emailType: "transactional",
        headers: {
            "Message-ID": `<${messageId}>`,
            ...(inReplyTo ? { "In-Reply-To": `<${inReplyTo}>`, References: `<${inReplyTo}>` } : {}),
            // Tell the far end this is machine-generated, so their autoresponder
            // doesn't reply to ours.
            "Auto-Submitted": "auto-replied",
            "X-Auto-Response-Suppress": "All",
        },
    });

    if (!result.success) {
        console.warn(`[auto-reply] Failed to acknowledge ${to}:`, result.error);
        return false;
    }

    await supabaseAdmin.from("ticket_messages").insert({
        ticket_id: ticketId,
        direction: "outbound",
        from_email: to, // the address acknowledged, so the 24h guard can find it
        author_email: "system",
        body_text: `${copy.greeting(firstName)}\n\n${copy.body}\n\n${copy.signoff}`,
        is_auto_reply: true,
        message_id: messageId,
        in_reply_to: inReplyTo,
        resend_id: result.id || null,
    });

    return true;
}
