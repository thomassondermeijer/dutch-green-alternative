import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ACUT_API_URL = process.env.ACUT_API_URL || "https://api.wms.acut-services.de/v1";
const ACUT_API_KEY = process.env.ACUT_API_KEY!;
const ACUT_USERNAME = process.env.ACUT_USERNAME!;
const ACUT_PASSWORD = process.env.ACUT_PASSWORD!;

/**
 * POST /api/admin/orders/[id]/send-to-acut
 * Sends an order to Acut WMS for fulfillment.
 */
export async function POST(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: orderId } = await params;

    try {
        // 1. Load the order
        const { data: order, error: orderError } = await supabaseAdmin
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        // Already sent to Acut?
        if (order.acut_order_id) {
            return NextResponse.json({ error: `Already sent to Acut (ID: ${order.acut_order_id})` }, { status: 400 });
        }

        // 2. Load order items with product SKUs
        const { data: items, error: itemsError } = await supabaseAdmin
            .from("order_items")
            .select("*, products:product_id (sku)")
            .eq("order_id", orderId);

        if (itemsError || !items || items.length === 0) {
            return NextResponse.json({ error: "No order items found" }, { status: 400 });
        }

        // 3. Parse addresses
        const shippingAddr = order.shipping_address;
        const billingAddr = order.billing_address || shippingAddr;

        // Map country codes (our form stores full names, Acut needs ISO codes)
        const countryMap: Record<string, string> = {
            "Netherlands": "NL",
            "Nederland": "NL",
            "Germany": "DE",
            "Deutschland": "DE",
            "Belgium": "BE",
            "België": "BE",
            "France": "FR",
            "NL": "NL",
            "DE": "DE",
            "BE": "BE",
            "FR": "FR",
        };

        const getCountryCode = (country: string) => countryMap[country] || country;

        // 4. Build the Acut order payload
        const acutPayload: Record<string, unknown> = {
            ext_id: order.order_number,
            priority: 1,
            shipping_address: {
                first_name: shippingAddr.first_name,
                last_name: shippingAddr.last_name,
                email: order.customer_email,
                street: shippingAddr.street,
                number: shippingAddr.house_number || "0",
                postal_code: shippingAddr.postal_code,
                city: shippingAddr.city,
                country: {
                    iso_code: getCountryCode(shippingAddr.country),
                },
            },
            invoice_address: {
                first_name: billingAddr.first_name,
                last_name: billingAddr.last_name,
                email: order.customer_email,
                street: billingAddr.street,
                number: billingAddr.house_number || "0",
                postal_code: billingAddr.postal_code,
                city: billingAddr.city,
                country: {
                    iso_code: getCountryCode(billingAddr.country),
                },
            },
            order_items: items.map((item) => {
                // SKU = barcode (user confirmed)
                const product = item.products as { sku: string } | null;
                const barcode = product?.sku || "";

                return {
                    amount: item.quantity,
                    price_net: Number(item.unit_price),
                    price_gross: Number(item.total_price) / item.quantity,
                    item: {
                        barcode: barcode,
                    },
                };
            }),
            ordered_at: order.created_at,
        };

        // Include carrier_id if customer selected a shipping method
        if (order.carrier_id) {
            acutPayload.carrier_id = order.carrier_id;
        }

        // 5. Send to Acut
        const basicAuth = Buffer.from(`${ACUT_USERNAME}:${ACUT_PASSWORD}`).toString("base64");

        const acutResponse = await fetch(`${ACUT_API_URL}/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-ACUT-API-KEY": ACUT_API_KEY,
                "Authorization": `Basic ${basicAuth}`,
            },
            body: JSON.stringify(acutPayload),
        });

        const acutResult = await acutResponse.json();

        if (!acutResponse.ok) {
            console.error("[Acut] Error creating order:", acutResult);
            return NextResponse.json(
                { error: acutResult.message || "Acut API error", details: acutResult },
                { status: acutResponse.status }
            );
        }

        // 6. Save Acut order ID back to our DB
        const acutOrderId = acutResult.data?.id?.toString() || null;

        await supabaseAdmin
            .from("orders")
            .update({
                acut_order_id: acutOrderId,
                status: order.status === "paid" ? "processing" : order.status,
                updated_at: new Date().toISOString(),
            })
            .eq("id", orderId);

        return NextResponse.json({
            success: true,
            acut_id: acutOrderId,
            acut_response: acutResult,
        });
    } catch (err) {
        console.error("[Acut] Unexpected error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
