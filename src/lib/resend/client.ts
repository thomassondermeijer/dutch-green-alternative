import { Resend } from "resend";
import { isEmailSuppressed, filterSuppressedEmails } from "./suppression";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "info@dutchgreenalternative.nl";
const FROM_NAME = "Dutch Green Alternative";

export type EmailTemplate =
    | "order-confirmation"
    | "shipping-notification"
    | "welcome"
    | "abandoned-cart"
    | "review-request";

type EmailType = "marketing" | "transactional";

type SendEmailOptions = {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
    emailType?: EmailType;
    /**
     * Extra RFC 5322 headers. Support replies set Message-ID / In-Reply-To /
     * References here so the conversation threads in the customer's mail
     * client and their reply comes back matchable.
     */
    headers?: Record<string, string>;
};

export async function sendEmail({ to, subject, html, replyTo, emailType = "transactional", headers }: SendEmailOptions) {
    try {
        // Check suppression list before sending
        const suppressed = await isEmailSuppressed(to, emailType);
        if (suppressed) {
            console.log(`[Resend] Skipping suppressed email (${emailType}): ${to}`);
            return { success: false, error: "suppressed", suppressed: true };
        }

        const { data, error } = await resend.emails.send({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to,
            subject,
            html,
            replyTo: replyTo || "info@dutchgreenalternative.nl",
            ...(headers ? { headers } : {}),
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
    emailType?: EmailType;
    /**
     * Per-recipient RFC 5322 headers. Marketing sends put the recipient's
     * signed List-Unsubscribe / List-Unsubscribe-Post here, which is what
     * makes Gmail, Yahoo and Apple Mail show their native Unsubscribe button.
     */
    headers?: Record<string, string>;
};

export type BatchResult = {
    to: string;
    success: boolean;
    id?: string;
    error?: unknown;
};

export async function sendBatchEmails(emails: BatchEmailItem[], emailType: EmailType = "marketing"): Promise<BatchResult[]> {
    if (emails.length === 0) return [];

    // Filter out suppressed emails
    const suppressedSet = await filterSuppressedEmails(
        emails.map((e) => e.to),
        emailType
    );

    const results: BatchResult[] = [];
    const unsuppressed: BatchEmailItem[] = [];

    for (const e of emails) {
        if (suppressedSet.has(e.to.toLowerCase())) {
            console.log(`[Resend Batch] Skipping suppressed: ${e.to}`);
            results.push({ to: e.to, success: false, error: "suppressed" });
        } else {
            unsuppressed.push(e);
        }
    }

    if (unsuppressed.length === 0) return results;

    const payload = unsuppressed.map((e) => ({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: e.to,
        subject: e.subject,
        html: e.html,
        replyTo: e.replyTo || "info@dutchgreenalternative.nl",
        ...(e.headers ? { headers: e.headers } : {}),
    }));

    try {
        const { data, error } = await resend.batch.send(payload);

        if (error) {
            console.error("[Resend Batch] API error:", error);
            // All unsuppressed failed — combine with suppressed results
            return [...results, ...unsuppressed.map((e) => ({ to: e.to, success: false, error }))];
        }

        // data.data is an array of { id } for each email sent
        const sentResults = data?.data || [];
        const batchResults = unsuppressed.map((e, i) => ({
            to: e.to,
            success: true,
            id: sentResults[i]?.id,
        }));
        return [...results, ...batchResults];
    } catch (err) {
        console.error("[Resend Batch] Error:", err);
        return [...results, ...unsuppressed.map((e) => ({ to: e.to, success: false, error: err }))];
    }
}

