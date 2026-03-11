import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildPaymentReminderEmail, getPaymentReminderSubject } from "@/lib/resend/templates/payment-reminder";
import { sendEmail } from "@/lib/resend/client";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/cron/invoice-reminders
 * 
 * Automated payment reminder cron job.
 * Schedule: daily
 * 
 * Reminder stages:
 * - Stage 1: 7 days after due date (friendly reminder)
 * - Stage 2: 14 days after due date (final notice)
 * - Stage 3: 21 days after due date (debt collection warning)
 * 
 * Protect this endpoint with a CRON_SECRET in production.
 */
export async function GET(req: NextRequest) {
    // Simple auth check for cron
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Find all unpaid invoice orders
        const { data: orders, error } = await supabaseAdmin
            .from("orders")
            .select("*")
            .eq("payment_method", "invoice")
            .in("payment_status", ["unpaid", "overdue"])
            .not("payment_due_date", "is", null);

        if (error) {
            console.error("[Invoice Reminders] Query error:", error);
            return NextResponse.json({ error: "DB error" }, { status: 500 });
        }

        if (!orders || orders.length === 0) {
            return NextResponse.json({ message: "No overdue invoices", sent: 0 });
        }

        const now = new Date();
        let sentCount = 0;
        const results: { orderNumber: string; stage: number; status: string }[] = [];

        for (const order of orders) {
            const dueDate = new Date(order.payment_due_date);
            const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

            // Not overdue yet
            if (daysPastDue < 7) {
                results.push({ orderNumber: order.order_number, stage: 0, status: "not_yet_due" });
                continue;
            }

            // Determine which reminder to send
            let reminderStage: 1 | 2 | 3 | null = null;

            if (daysPastDue >= 21 && order.reminder_count < 3) {
                reminderStage = 3; // Debt collection warning
            } else if (daysPastDue >= 14 && order.reminder_count < 2) {
                reminderStage = 2; // Final notice
            } else if (daysPastDue >= 7 && order.reminder_count < 1) {
                reminderStage = 1; // Friendly reminder
            }

            if (!reminderStage) {
                results.push({ orderNumber: order.order_number, stage: order.reminder_count, status: "already_sent" });
                continue;
            }

            // Get customer name from shipping address
            const addr = order.shipping_address || {};
            const customerName = `${addr.first_name || ""} ${addr.last_name || ""}`.trim();

            // Format due date for display
            const locale = order.language || "de";
            const dueDateStr = dueDate.toLocaleDateString(
                locale === "de" ? "de-DE" : locale === "nl" ? "nl-NL" : "en-GB",
                { day: "2-digit", month: "long", year: "numeric" }
            );

            // Build and send reminder email
            const reminderData = {
                orderNumber: order.order_number,
                customerName,
                total: Number(order.total),
                paymentDueDate: dueDateStr,
                daysPastDue,
                reminderStage,
                locale,
            };

            const html = buildPaymentReminderEmail(reminderData);
            const subject = getPaymentReminderSubject(reminderData);

            const emailResult = await sendEmail({
                to: order.customer_email,
                subject,
                html,
            });

            if (emailResult.success) {
                // Log the communication
                await supabaseAdmin
                    .from("order_communications")
                    .insert({
                        order_id: order.id,
                        type: `reminder_${reminderStage}`,
                        subject,
                        recipient: order.customer_email,
                        html,
                    });

                // Update the order
                await supabaseAdmin
                    .from("orders")
                    .update({
                        reminder_count: reminderStage,
                        last_reminder_at: now.toISOString(),
                        payment_status: "overdue",
                        updated_at: now.toISOString(),
                    })
                    .eq("id", order.id);

                sentCount++;
                results.push({ orderNumber: order.order_number, stage: reminderStage, status: "sent" });
            } else {
                results.push({ orderNumber: order.order_number, stage: reminderStage, status: "email_failed" });
            }
        }

        return NextResponse.json({
            message: `Processed ${orders.length} orders, sent ${sentCount} reminders`,
            sent: sentCount,
            results,
        });
    } catch (err) {
        console.error("[Invoice Reminders] Error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
