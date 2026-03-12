import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/resend/client";
import { buildPostDeliveryTipsEmail } from "@/lib/resend/templates/post-delivery-tips";
import { buildReviewRequestEmail } from "@/lib/resend/templates/review-request";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/cron/email-sequences
 *
 * Automated email sequence processor. Runs hourly.
 * Checks delivered orders against sequence definitions and sends emails
 * that haven't been sent yet.
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // 1. Get active sequences and their steps
        const { data: sequences } = await supabaseAdmin
            .from("email_sequences")
            .select("*, email_sequence_steps(*)")
            .eq("is_active", true);

        if (!sequences || sequences.length === 0) {
            return NextResponse.json({ message: "No active sequences", sent: 0 });
        }

        const now = new Date();
        let totalSent = 0;
        const results: { email: string; template: string; status: string }[] = [];

        // 2. Process each sequence
        for (const seq of sequences) {
            if (seq.trigger_event !== "order_delivered") continue;

            const steps = (seq.email_sequence_steps || []).sort(
                (a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order
            );

            for (const step of steps) {
                if (!step.is_active) continue;

                // Find delivered orders where enough time has passed
                const cutoffDate = new Date(now.getTime() - step.delay_hours * 3600000);

                const { data: eligibleOrders } = await supabaseAdmin
                    .from("orders")
                    .select("id, order_number, customer_email, language, delivered_at, shipping_address")
                    .eq("status", "delivered")
                    .not("delivered_at", "is", null)
                    .lte("delivered_at", cutoffDate.toISOString());

                if (!eligibleOrders || eligibleOrders.length === 0) continue;

                // Check which have already been sent this step
                const emailAddresses = eligibleOrders.map((o) => o.customer_email);
                const orderIds = eligibleOrders.map((o) => o.id);

                const { data: alreadySent } = await supabaseAdmin
                    .from("email_log")
                    .select("order_id")
                    .eq("template", step.template_slug)
                    .in("order_id", orderIds);

                const sentOrderIds = new Set((alreadySent || []).map((s) => s.order_id));

                // Filter to unsent orders
                const toSend = eligibleOrders.filter((o) => !sentOrderIds.has(o.id));

                // Get order items for product names
                for (const order of toSend) {
                    const locale = order.language || "de";
                    const addr = order.shipping_address || {};
                    const customerName = `${(addr as Record<string, string>).first_name || ""} ${(addr as Record<string, string>).last_name || ""}`.trim() || "Kunde";

                    // Get product names for this order
                    const { data: items } = await supabaseAdmin
                        .from("order_items")
                        .select("product_name")
                        .eq("order_id", order.id);
                    const productNames = (items || []).map((i) => i.product_name);

                    // Build email
                    let html = "";
                    let subject = "";

                    const subjectKey = `subject_${locale}` as keyof typeof step;
                    subject = (step[subjectKey] as string) || step.subject_de;

                    switch (step.template_slug) {
                        case "post-delivery-tips":
                            html = buildPostDeliveryTipsEmail({ customerName, productNames, locale });
                            break;
                        case "review-request": {
                            // Generate review token for this order
                            const reviewToken = `rv_${order.id.replace(/-/g, "").slice(0, 12)}_${Date.now().toString(36)}`;
                            // Store token on order
                            await supabaseAdmin.from("orders").update({ review_token: reviewToken }).eq("id", order.id);
                            html = buildReviewRequestEmail({
                                customerName,
                                orderNumber: order.order_number,
                                productNames,
                                locale,
                                reviewToken,
                            });
                            break;
                        }
                        default:
                            continue;
                    }

                    // Send
                    const result = await sendEmail({ to: order.customer_email, subject, html });

                    // Log to email_log
                    await supabaseAdmin.from("email_log").insert({
                        recipient: order.customer_email,
                        template: step.template_slug,
                        subject,
                        language: locale,
                        status: result.success ? "sent" : "failed",
                        resend_id: result.id || null,
                        order_id: order.id,
                        sequence_slug: seq.slug,
                        step_id: step.id,
                        metadata: { order_number: order.order_number, products: productNames },
                    });

                    if (result.success) {
                        totalSent++;
                        results.push({ email: order.customer_email, template: step.template_slug, status: "sent" });
                    } else {
                        results.push({ email: order.customer_email, template: step.template_slug, status: "failed" });
                    }
                }
            }
        }

        return NextResponse.json({
            message: `Processed sequences, sent ${totalSent} emails`,
            sent: totalSent,
            results,
        });
    } catch (err) {
        console.error("[Email Sequences] Error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
