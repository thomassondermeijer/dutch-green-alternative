import { NextRequest } from "next/server";
import { buildInvoiceEmail } from "@/lib/resend/templates/invoice";
import { sendEmail } from "@/lib/resend/client";

// --- Types ---
type CheckoutItem = {
    id: string;
    slug: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
};

type CheckoutBody = {
    items: CheckoutItem[];
    email: string;
    phone?: string;
    firstName: string;
    lastName: string;
    street: string;
    houseNumber: string;
    city: string;
    postalCode: string;
    country: string;
    billingFirstName?: string;
    billingLastName?: string;
    billingStreet?: string;
    billingHouseNumber?: string;
    billingCity?: string;
    billingPostalCode?: string;
    billingCountry?: string;
    sameAsShipping: boolean;
    couponCode?: string;
    discountAmount?: number;
    paymentMethod?: string;
    carrierId?: number;
    locale: string;
};

// --- Helpers ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function supabaseQuery(
    path: string,
    options: {
        method?: string;
        body?: unknown;
        headers?: Record<string, string>;
        prefer?: string;
    } = {}
) {
    const headers: Record<string, string> = {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        ...options.headers,
    };
    if (options.prefer) {
        headers["Prefer"] = options.prefer;
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase error (${res.status}): ${text}`);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

async function generateOrderNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

    // Count today's orders
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const orders = await supabaseQuery(
        `orders?order_number=like.DGA-${dateStr}-*&select=id`,
    );

    const count = (orders?.length || 0) + 1;
    return `DGA-${dateStr}-${String(count).padStart(3, "0")}`;
}

async function upsertCustomer(data: CheckoutBody): Promise<string> {
    // Check if customer with this email exists
    const existing = await supabaseQuery(
        `customers?email=eq.${encodeURIComponent(data.email)}&select=id`
    );

    const address = {
        first_name: data.firstName,
        last_name: data.lastName,
        street: data.street,
        house_number: data.houseNumber,
        city: data.city,
        postal_code: data.postalCode,
        country: data.country,
    };

    if (existing && existing.length > 0) {
        // Update existing customer
        await supabaseQuery(
            `customers?id=eq.${existing[0].id}`,
            {
                method: "PATCH",
                body: {
                    first_name: data.firstName,
                    last_name: data.lastName,
                    phone: data.phone || null,
                    language_pref: data.locale,
                    addresses: [address],
                    updated_at: new Date().toISOString(),
                },
            }
        );
        return existing[0].id;
    }

    // Create new customer
    const result = await supabaseQuery("customers", {
        method: "POST",
        body: {
            email: data.email,
            first_name: data.firstName,
            last_name: data.lastName,
            phone: data.phone || null,
            language_pref: data.locale,
            addresses: [address],
        },
        prefer: "return=representation",
    });

    return result[0].id;
}

async function registerCuroPayment(
    orderNumber: string,
    totalCents: number,
    data: CheckoutBody,
    paymentMethod: string,
    clientIp: string
): Promise<{
    payment_url: string;
    transaction_id: string;
} | { error: string } | null> {
    const merchantId = process.env.CARDGATE_MERCHANT_ID;
    const apiSecret = process.env.CARDGATE_API_SECRET;
    const siteId = process.env.CARDGATE_SITE_ID;
    const testMode = process.env.CARDGATE_TEST_MODE === "true";

    if (!merchantId || !apiSecret || !siteId) {
        console.error("CardGate credentials not configured");
        return { error: "Payment gateway not configured" };
    }

    const baseUrl = "https://secure.curopayments.net/rest/v1/curo";
    const authHeader = `Basic ${Buffer.from(`${merchantId}:${apiSecret}`).toString("base64")}`;

    // Determine the host for callback/success URLs
    const host = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const requestBody = {
        site_id: parseInt(siteId),
        amount: totalCents,
        currency_id: "EUR",
        url_callback: `${host}/api/checkout/callback`,
        url_success: `${host}/${data.locale}/checkout/success?order=${orderNumber}`,
        url_failure: `${host}/${data.locale}/checkout?error=payment_failed`,
        reference: orderNumber,
        description: `DGA Order ${orderNumber}`,
        consumer: {
            email: data.email,
            firstname: data.firstName,
            lastname: data.lastName,
            phone: data.phone || undefined,
            address: `${data.street} ${data.houseNumber}`,
            city: data.city,
            zipcode: data.postalCode,
            country_id: data.country,
        },
        ip: clientIp,
    };

    try {
        const res = await fetch(`${baseUrl}/payment/${paymentMethod}/`, {
            method: "POST",
            headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`CURO payment registration failed (${res.status}):`, errorText);
            return { error: `Payment gateway error (${res.status}): ${errorText}` };
        }

        const result = await res.json();
        console.log("CURO response:", JSON.stringify(result));

        return {
            payment_url: result.payment?.url || result.url || "",
            transaction_id: result.payment?.transaction_id || result.transaction_id || "",
        };
    } catch (err) {
        console.error("CURO API error:", err);
        return { error: `Payment gateway connection failed: ${err}` };
    }
}

// --- Main Handler ---
export async function POST(req: NextRequest) {
    try {
        const body: CheckoutBody = await req.json();

        // Validate required fields
        if (!body.items || body.items.length === 0) {
            return new Response(
                JSON.stringify({ error: "Cart is empty" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }
        if (!body.email || !body.firstName || !body.lastName) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // 1. Calculate totals
        const subtotal = body.items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );
        const shippingCost = subtotal >= 65 ? 0 : 4.95;
        const discountAmount = body.discountAmount || 0;
        const isInvoice = body.paymentMethod === "invoice";
        const invoiceSurcharge = isInvoice ? 1.99 : 0;
        const total = subtotal + shippingCost + invoiceSurcharge - discountAmount;

        // 2. Upsert customer
        const customerId = await upsertCustomer(body);

        // 3. Generate order number
        const orderNumber = await generateOrderNumber();

        // 4. Build addresses
        const shippingAddress = {
            first_name: body.firstName,
            last_name: body.lastName,
            street: body.street,
            house_number: body.houseNumber,
            city: body.city,
            postal_code: body.postalCode,
            country: body.country,
        };

        const billingAddress = body.sameAsShipping
            ? shippingAddress
            : {
                first_name: body.billingFirstName,
                last_name: body.billingLastName,
                street: body.billingStreet,
                house_number: body.billingHouseNumber,
                city: body.billingCity,
                postal_code: body.billingPostalCode,
                country: body.billingCountry,
            };

        // 5. Create order
        const orderResult = await supabaseQuery("orders", {
            method: "POST",
            body: {
                order_number: orderNumber,
                customer_id: customerId,
                customer_email: body.email,
                status: "pending",
                subtotal,
                shipping_cost: shippingCost,
                discount_amount: discountAmount,
                total,
                shipping_address: shippingAddress,
                billing_address: billingAddress,
                language: body.locale,
                coupon_code: body.couponCode || null,
                carrier_id: body.carrierId || null,
                payment_method: body.paymentMethod || "ideal",
                invoice_surcharge: invoiceSurcharge,
                payment_status: "unpaid",
                ...(isInvoice ? {
                    payment_due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                } : {}),
            },
            prefer: "return=representation",
        });

        const orderId = orderResult[0].id;

        // 6. Create order items
        const orderItems = body.items.map((item) => ({
            order_id: orderId,
            product_id: item.id,
            product_name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            total_price: item.price * item.quantity,
        }));

        await supabaseQuery("order_items", {
            method: "POST",
            body: orderItems,
        });

        // --- INVOICE FLOW ---
        if (isInvoice) {
            // Calculate due date
            const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
            const dueDateStr = dueDate.toLocaleDateString(
                body.locale === "de" ? "de-DE" : body.locale === "nl" ? "nl-NL" : "en-GB",
                { day: "2-digit", month: "long", year: "numeric" }
            );

            // Build shipping address string
            const addrStr = `${body.firstName} ${body.lastName}\n${body.street} ${body.houseNumber}\n${body.postalCode} ${body.city}\n${body.country}`;

            // Send invoice email
            const invoiceHtml = buildInvoiceEmail({
                orderNumber,
                customerName: body.firstName,
                items: body.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
                subtotal,
                shipping: shippingCost,
                discount: discountAmount > 0 ? discountAmount : undefined,
                invoiceSurcharge,
                total,
                shippingAddress: addrStr,
                paymentDueDate: dueDateStr,
                locale: body.locale,
            });

            const subjectMap: Record<string, string> = {
                de: `Rechnung #${orderNumber} - Dutch Green Alternative`,
                nl: `Factuur #${orderNumber} - Dutch Green Alternative`,
                en: `Invoice #${orderNumber} - Dutch Green Alternative`,
            };

            await sendEmail({
                to: body.email,
                subject: subjectMap[body.locale] || subjectMap.de,
                html: invoiceHtml,
            });

            // Log the communication
            const emailSubject = subjectMap[body.locale] || subjectMap.de;
            await supabaseQuery("order_communications", {
                method: "POST",
                body: {
                    order_id: orderId,
                    type: "invoice",
                    subject: emailSubject,
                    recipient: body.email,
                    html: invoiceHtml,
                },
            });

            // Mark invoice as sent
            await supabaseQuery(`orders?id=eq.${orderId}`, {
                method: "PATCH",
                body: { invoice_sent_at: new Date().toISOString() },
            });

            return new Response(
                JSON.stringify({
                    success: true,
                    order_number: orderNumber,
                    payment_url: null,
                    message: "Invoice sent. Payment due in 14 days.",
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

        // --- STANDARD PAYMENT FLOW ---
        const paymentMethod = body.paymentMethod || "ideal";
        const totalCents = Math.round(total * 100);

        // Get client IP for CardGate
        const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
            || req.headers.get("x-real-ip")
            || "127.0.0.1";

        const payment = await registerCuroPayment(
            orderNumber,
            totalCents,
            body,
            paymentMethod,
            clientIp
        );

        if (payment && 'error' in payment) {
            console.error("Payment registration failed:", payment.error);
            return new Response(
                JSON.stringify({
                    error: `Payment failed: ${payment.error}`,
                    order_number: orderNumber,
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        if (payment && payment.payment_url) {
            // Save transaction ID on order
            await supabaseQuery(`orders?id=eq.${orderId}`, {
                method: "PATCH",
                body: {
                    curo_transaction_id: payment.transaction_id,
                },
            });

            return new Response(
                JSON.stringify({
                    success: true,
                    order_number: orderNumber,
                    payment_url: payment.payment_url,
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

        // If no payment URL returned but no error either
        return new Response(
            JSON.stringify({
                error: "Payment gateway returned no payment URL. Please try again or choose a different payment method.",
                order_number: orderNumber,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("Checkout error:", err);
        return new Response(
            JSON.stringify({ error: "Failed to process order" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
