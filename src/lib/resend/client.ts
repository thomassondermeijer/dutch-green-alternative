import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@dutchgreenalternative.nl";
const FROM_NAME = "Dutch Green Alternative";

export type EmailTemplate =
    | "order-confirmation"
    | "shipping-notification"
    | "welcome"
    | "abandoned-cart"
    | "review-request";

type SendEmailOptions = {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
};

export async function sendEmail({ to, subject, html, replyTo }: SendEmailOptions) {
    try {
        const { data, error } = await resend.emails.send({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to,
            subject,
            html,
            replyTo: replyTo || "info@dutchgreenalternative.nl",
        });

        if (error) {
            console.error("[Resend] Failed to send email:", error);
            return { success: false, error };
        }

        return { success: true, id: data?.id };
    } catch (err) {
        console.error("[Resend] Error:", err);
        return { success: false, error: err };
    }
}

/**
 * Send up to 100 emails in a single API call using Resend's batch endpoint.
 * This avoids the 2 req/sec rate limit for individual sends.
 */
export type BatchEmailItem = {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
};

export type BatchResult = {
    to: string;
    success: boolean;
    id?: string;
    error?: unknown;
};

export async function sendBatchEmails(emails: BatchEmailItem[]): Promise<BatchResult[]> {
    if (emails.length === 0) return [];

    const payload = emails.map((e) => ({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: e.to,
        subject: e.subject,
        html: e.html,
        replyTo: e.replyTo || "info@dutchgreenalternative.nl",
    }));

    try {
        const { data, error } = await resend.batch.send(payload);

        if (error) {
            console.error("[Resend Batch] API error:", error);
            // All failed — return failure for every email
            return emails.map((e) => ({ to: e.to, success: false, error }));
        }

        // data.data is an array of { id } for each email sent
        const results = data?.data || [];
        return emails.map((e, i) => ({
            to: e.to,
            success: true,
            id: results[i]?.id,
        }));
    } catch (err) {
        console.error("[Resend Batch] Error:", err);
        return emails.map((e) => ({ to: e.to, success: false, error: err }));
    }
}

