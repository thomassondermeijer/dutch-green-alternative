import { NextRequest } from "next/server";

/**
 * CardGate/CURO Callback Handler
 * 
 * This endpoint receives server-to-server callbacks from CURO after
 * a payment status changes. It is NOT user-facing.
 * 
 * CURO status codes:
 *   0   = Pending
 *   200 = Success
 *   210 = Recurring success
 *   300 = Failed
 *   301 = Failed (acquirer)
 *   302 = Expired
 *   400 = Refund
 *   700 = Cancelled by consumer
 *   800 = Authorized (not yet captured)
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function mapCuroStatus(code: number): string {
    if (code === 200 || code === 210) return "paid";
    if (code === 800) return "processing"; // authorized
    if (code === 300 || code === 301 || code === 302) return "cancelled";
    if (code === 700) return "cancelled";
    if (code === 400) return "refunded";
    return "pending";
}

export async function POST(req: NextRequest) {
    try {
        // CURO sends callbacks as form-encoded or JSON
        let transactionId: string | null = null;
        let statusCode: number | null = null;
        let reference: string | null = null;

        const contentType = req.headers.get("content-type") || "";

        if (contentType.includes("application/x-www-form-urlencoded")) {
            const formData = await req.formData();
            transactionId = formData.get("transaction_id") as string;
            statusCode = parseInt(formData.get("code") as string);
            reference = formData.get("reference") as string;
        } else {
            const body = await req.json();
            transactionId = body.transaction_id || body.transaction;
            statusCode = parseInt(body.code || body.status_code || "0");
            reference = body.reference;
        }

        if (!transactionId && !reference) {
            return new Response(
                JSON.stringify({ error: "Missing transaction identifier" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Find the order by transaction ID or order number
        let findPath = "";
        if (transactionId) {
            findPath = `orders?curo_transaction_id=eq.${encodeURIComponent(transactionId)}&select=id,status,order_number`;
        } else if (reference) {
            findPath = `orders?order_number=eq.${encodeURIComponent(reference)}&select=id,status,order_number`;
        }

        const orderRes = await fetch(`${supabaseUrl}/rest/v1/${findPath}`, {
            headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
            },
        });

        if (!orderRes.ok) {
            console.error("Failed to find order:", await orderRes.text());
            return new Response(
                JSON.stringify({ error: "Order lookup failed" }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        const orders = await orderRes.json();

        if (!orders || orders.length === 0) {
            console.error("Order not found for:", { transactionId, reference });
            return new Response(
                JSON.stringify({ error: "Order not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        const order = orders[0];
        const newStatus = statusCode !== null ? mapCuroStatus(statusCode) : order.status;

        // Update order status
        const updateRes = await fetch(
            `${supabaseUrl}/rest/v1/orders?id=eq.${order.id}`,
            {
                method: "PATCH",
                headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    status: newStatus,
                    payment_status: newStatus === "paid" ? "paid" : newStatus === "refunded" ? "refunded" : undefined,
                    paid_at: newStatus === "paid" ? new Date().toISOString() : undefined,
                    curo_transaction_id: transactionId || undefined,
                    updated_at: new Date().toISOString(),
                }),
            }
        );

        if (!updateRes.ok) {
            console.error("Failed to update order:", await updateRes.text());
            return new Response(
                JSON.stringify({ error: "Order update failed" }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        console.log(
            `[CardGate Callback] Order ${order.order_number}: ${order.status} → ${newStatus} (code: ${statusCode})`
        );

        // Send order-confirmation email when payment succeeds
        if (newStatus === "paid") {
            try {
                // Fetch full order data
                const fullOrderRes = await fetch(
                    `${supabaseUrl}/rest/v1/orders?id=eq.${order.id}&select=*`,
                    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
                );
                const [fullOrder] = await fullOrderRes.json();

                // Fetch order items
                const itemsRes = await fetch(
                    `${supabaseUrl}/rest/v1/order_items?order_id=eq.${order.id}&select=product_name,quantity,unit_price`,
                    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
                );
                const items = await itemsRes.json();

                if (fullOrder && items) {
                    const { buildOrderConfirmationEmail } = await import("@/lib/resend/templates/order-confirmation");
                    const { sendEmail } = await import("@/lib/resend/client");

                    const addr = fullOrder.shipping_address || {};
                    const locale = fullOrder.language || "de";
                    const country = addr.country || "DE";

                    const html = buildOrderConfirmationEmail({
                        orderNumber: fullOrder.order_number,
                        customerName: addr.first_name || "Kunde",
                        items: items.map((i: { product_name: string; quantity: number; unit_price: number }) => ({
                            name: i.product_name, quantity: i.quantity, price: i.unit_price,
                        })),
                        subtotal: Number(fullOrder.subtotal),
                        shipping: Number(fullOrder.shipping_cost || 0),
                        discount: fullOrder.discount_amount ? Number(fullOrder.discount_amount) : undefined,
                        total: Number(fullOrder.total),
                        shippingAddress: `${addr.first_name || ""} ${addr.last_name || ""}\n${addr.street || ""} ${addr.house_number || ""}\n${addr.postal_code || ""} ${addr.city || ""}\n${addr.country || ""}`,
                        locale,
                    });

                    const subjectMap: Record<string, string> = {
                        de: `Bestellbestätigung #${fullOrder.order_number}`,
                        nl: `Orderbevestiging #${fullOrder.order_number}`,
                        en: `Order Confirmation #${fullOrder.order_number}`,
                    };

                    await sendEmail({
                        to: fullOrder.customer_email,
                        subject: subjectMap[locale] || subjectMap.de,
                        html,
                    });

                    console.log(`[CardGate Callback] Order confirmation sent for ${fullOrder.order_number}`);
                }
            } catch (emailErr) {
                console.error("[CardGate Callback] Failed to send order confirmation:", emailErr);
                // Don't fail the callback for email errors
            }
        }

        // CURO expects a simple response
        return new Response(
            `${order.order_number}.${statusCode}`,
            { status: 200, headers: { "Content-Type": "text/plain" } }
        );
    } catch (err) {
        console.error("Callback error:", err);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}

// Also handle GET — some payment gateways use GET for callbacks
export async function GET(req: NextRequest) {
    // Convert GET params to a pseudo-POST
    const url = new URL(req.url);
    const body = {
        transaction_id: url.searchParams.get("transaction_id") || url.searchParams.get("transaction"),
        code: url.searchParams.get("code") || url.searchParams.get("status_code"),
        reference: url.searchParams.get("reference") || url.searchParams.get("ref"),
    };

    const newReq = new NextRequest(req.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    return POST(newReq);
}
