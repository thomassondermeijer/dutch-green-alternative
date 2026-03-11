import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend/client";
import { buildOrderConfirmationEmail } from "@/lib/resend/templates/order-confirmation";
import { buildShippingNotificationEmail } from "@/lib/resend/templates/shipping-notification";
import { buildWelcomeEmail } from "@/lib/resend/templates/welcome";
import { buildInvoiceEmail } from "@/lib/resend/templates/invoice";
import { buildPaymentReminderEmail, getPaymentReminderSubject } from "@/lib/resend/templates/payment-reminder";

export async function POST(req: NextRequest) {
    try {
        // Simple API key check (use a proper secret in production)
        const authHeader = req.headers.get("authorization");
        const expectedKey = process.env.RESEND_API_KEY;
        if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { template, to, data } = await req.json();

        if (!template || !to || !data) {
            return NextResponse.json(
                { error: "Missing template, to, or data" },
                { status: 400 }
            );
        }

        let subject: string;
        let html: string;

        switch (template) {
            case "order-confirmation": {
                const subjectMap: Record<string, string> = {
                    de: `Bestellbestätigung #${data.orderNumber}`,
                    nl: `Orderbevestiging #${data.orderNumber}`,
                    en: `Order Confirmation #${data.orderNumber}`,
                };
                subject = subjectMap[data.locale] || subjectMap.de;
                html = buildOrderConfirmationEmail(data);
                break;
            }
            case "shipping-notification": {
                const subjectMap: Record<string, string> = {
                    de: `Ihre Bestellung #${data.orderNumber} wurde versendet`,
                    nl: `Uw bestelling #${data.orderNumber} is verzonden`,
                    en: `Your order #${data.orderNumber} has been shipped`,
                };
                subject = subjectMap[data.locale] || subjectMap.de;
                html = buildShippingNotificationEmail(data);
                break;
            }
            case "welcome": {
                const subjectMap: Record<string, string> = {
                    de: "Willkommen bei Dutch Green Alternative!",
                    nl: "Welkom bij Dutch Green Alternative!",
                    en: "Welcome to Dutch Green Alternative!",
                };
                subject = subjectMap[data.locale] || subjectMap.de;
                html = buildWelcomeEmail(data);
                break;
            }
            case "invoice": {
                const subjectMap: Record<string, string> = {
                    de: `Rechnung #${data.orderNumber} - Dutch Green Alternative`,
                    nl: `Factuur #${data.orderNumber} - Dutch Green Alternative`,
                    en: `Invoice #${data.orderNumber} - Dutch Green Alternative`,
                };
                subject = subjectMap[data.locale] || subjectMap.de;
                html = buildInvoiceEmail(data);
                break;
            }
            case "payment-reminder": {
                subject = getPaymentReminderSubject(data);
                html = buildPaymentReminderEmail(data);
                break;
            }
            default:
                return NextResponse.json(
                    { error: `Unknown template: ${template}` },
                    { status: 400 }
                );
        }

        const result = await sendEmail({ to, subject, html });

        if (result.success) {
            return NextResponse.json({ success: true, id: result.id });
        } else {
            return NextResponse.json(
                { success: false, error: "Failed to send" },
                { status: 500 }
            );
        }
    } catch {
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
