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
