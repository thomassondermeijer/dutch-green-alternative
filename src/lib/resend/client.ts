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
