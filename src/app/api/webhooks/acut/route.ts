import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/resend/client";
import { buildShippingNotificationEmail } from "@/lib/resend/templates/shipping-notification";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Whitelisted Acut server IPs
const ALLOWED_IPS = new Set([
    "212.227.162.149",
    "185.56.151.111",
    "212.227.143.239",
]);

const WEBHOOK_SECRET = process.env.ACUT_WEBHOOK_SECRET || "";

/**
 * Extract the client IP from various headers (Netlify / Cloudflare / standard).
 */
function getClientIp(req: NextRequest): string | null {
    return (
        req.headers.get("x-nf-client-connection-ip") ||
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        null
    );
}

/**
 * POST /api/webhooks/acut
 *
 * Receives track & trace updates from Acut WMS.
 * When an order is shipped, Acut sends the tracking number and URL.
 * We update the order, change status to "shipped", and send the
 * shipping notification email to the customer automatically.
 */
export async function POST(req: NextRequest) {
    try {
        // 1. IP whitelist check (log-only mode while testing)
        const clientIp = getClientIp(req);
        if (!clientIp || !ALLOWED_IPS.has(clientIp)) {
            console.warn(`[Acut Webhook] Unknown IP: ${clientIp} — allowing for testing`);
            // TODO: Re-enable blocking after confirming correct IPs
            // return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        } else {
            console.log(`[Acut Webhook] Verified IP: ${clientIp}`);
        }

        // 2. Optional shared secret check
        if (WEBHOOK_SECRET) {
            const secret = req.headers.get("x-webhook-secret");
            if (secret !== WEBHOOK_SECRET) {
                console.warn("[Acut Webhook] Invalid secret");
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        // 3. Parse the payload (flexible field names)
        const body = await req.json();
        console.log("[Acut Webhook] Received:", JSON.stringify(body));

        const orderRef =
            body.ext_id ||
            body.external_id ||
            body.order_number ||
            body.reference ||
            null;

        const acutOrderId =
            body.order_id ||
            body.id ||
            null;

        const trackingNumber =
            body.tracking_number ||
            body.tracking_code ||
            body.trackingNumber ||
            body.barcode ||
            null;

        const trackingUrl =
            body.tracking_url ||
            body.tracking_link ||
            body.trackingUrl ||
            null;

        if (!orderRef && !acutOrderId) {
            return NextResponse.json(
                { error: "Missing order reference (ext_id or order_id)" },
                { status: 400 }
            );
        }

        // 4. Look up the order
        let order = null;

        // Try by ext_id → order_number first
        if (orderRef) {
            const { data } = await supabaseAdmin
                .from("orders")
                .select("*")
                .eq("order_number", orderRef)
                .single();
            order = data;
        }

        // Fallback: try by acut_order_id
        if (!order && acutOrderId) {
            const { data } = await supabaseAdmin
                .from("orders")
                .select("*")
                .eq("acut_order_id", String(acutOrderId))
                .single();
            order = data;
        }

        if (!order) {
            console.warn(`[Acut Webhook] Order not found: ext_id=${orderRef}, order_id=${acutOrderId}`);
            return NextResponse.json(
                { error: "Order not found" },
                { status: 404 }
            );
        }

        // 5. Update order with tracking info
        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (trackingNumber) {
            updateData.tracking_number = trackingNumber;
        }
        if (trackingUrl) {
            updateData.tracking_url = trackingUrl;
        }

        // Set status to "shipped" if currently processing or paid
        if (["processing", "paid", "pending"].includes(order.status)) {
            updateData.status = "shipped";
        }

        await supabaseAdmin
            .from("orders")
            .update(updateData)
            .eq("id", order.id);

        console.log(`[Acut Webhook] Updated order ${order.order_number}: tracking=${trackingNumber}`);

        // 6. Send shipping notification email (always, even without tracking)
        let emailSent = false;
        if (order.customer_email) {
            const addr = order.shipping_address || {};
            const customerName = `${addr.first_name || ""} ${addr.last_name || ""}`.trim() || "Customer";
            const locale = order.language || "de";

            const subjectMap: Record<string, string> = {
                de: `Ihre Bestellung #${order.order_number} wurde versendet`,
                nl: `Uw bestelling #${order.order_number} is verzonden`,
                en: `Your order #${order.order_number} has been shipped`,
            };
            const subject = subjectMap[locale] || subjectMap.de;

            const html = buildShippingNotificationEmail({
                customerName,
                orderNumber: order.order_number,
                trackingNumber: trackingNumber || undefined,
                trackingUrl: trackingUrl || undefined,
                locale,
            });

            const emailResult = await sendEmail({
                to: order.customer_email,
                subject,
                html,
            });

            if (emailResult.success) {
                emailSent = true;

                // Log to order_communications
                await supabaseAdmin
                    .from("order_communications")
                    .insert({
                        order_id: order.id,
                        type: "shipping_notification",
                        subject,
                        recipient: order.customer_email,
                        html,
                    });

                console.log(`[Acut Webhook] Shipping email sent to ${order.customer_email}`);
            } else {
                console.error(`[Acut Webhook] Email failed for ${order.customer_email}:`, emailResult.error);
            }
        }

        return NextResponse.json({
            success: true,
            order_number: order.order_number,
            tracking_number: trackingNumber,
            status_updated: updateData.status || order.status,
            email_sent: emailSent,
        });
    } catch (err) {
        console.error("[Acut Webhook] Error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
