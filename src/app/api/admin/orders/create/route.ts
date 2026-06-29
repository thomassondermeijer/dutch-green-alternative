import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { buildInvoiceEmail } from "@/lib/resend/templates/invoice";
import { sendEmail } from "@/lib/resend/client";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const INVOICE_SURCHARGE = 1.99;

async function isAdmin(): Promise<boolean> {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll() { /* read-only */ },
            },
        }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return false;
    const { data: adminUser } = await supabaseAdmin
        .from("admin_users").select("id").eq("email", user.email).single();
    return !!adminUser;
}

type Addr = { street: string; houseNumber: string; postalCode: string; city: string; country: string };
type CreateBody = {
    email: string; firstName: string; lastName: string; phone?: string;
    shipping: Addr; billing?: Addr | null;
    items: { productId: string; quantity: number }[];
    shippingCost: number; discountAmount: number; invoiceFee: boolean;
    language: "de" | "nl" | "en";
};

function addrToColumns(a: Addr) {
    return {
        first_name: "", last_name: "",
        street: a.street, house_number: a.houseNumber,
        city: a.city, postal_code: a.postalCode, country: a.country,
    };
}

export async function POST(req: NextRequest) {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: CreateBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Validate
    if (!body.email || !body.firstName || !body.lastName) {
        return NextResponse.json({ error: "Email, first name and last name are required" }, { status: 400 });
    }
    const s = body.shipping;
    if (!s || !s.street || !s.houseNumber || !s.postalCode || !s.city || !s.country) {
        return NextResponse.json({ error: "Complete shipping address is required" }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json({ error: "Add at least one product" }, { status: 400 });
    }
    const language = ["de", "nl", "en"].includes(body.language) ? body.language : "de";
    const shippingCost = Math.max(0, Number(body.shippingCost) || 0);
    const discountAmount = Math.max(0, Number(body.discountAmount) || 0);
    const invoiceSurcharge = body.invoiceFee ? INVOICE_SURCHARGE : 0;

    // Look up products by id (authoritative prices + names)
    const ids = [...new Set(body.items.map((i) => i.productId))];
    const { data: products, error: prodErr } = await supabaseAdmin
        .from("products").select("id, slug, price, translations").in("id", ids).eq("is_active", true);
    if (prodErr) {
        return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
    }
    const productMap = new Map((products || []).map((p) => [p.id, p]));

    const lineItems: { product_id: string; product_name: string; quantity: number; unit_price: number; total_price: number }[] = [];
    for (const item of body.items) {
        const p = productMap.get(item.productId);
        if (!p) {
            return NextResponse.json({ error: `Product not found or inactive: ${item.productId}` }, { status: 400 });
        }
        const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const unitPrice = Number(p.price);
        const tr = (p.translations || {}) as Record<string, { name?: string }>;
        const name = tr[language]?.name || tr.de?.name || p.slug;
        lineItems.push({
            product_id: p.id, product_name: name, quantity: qty,
            unit_price: unitPrice, total_price: unitPrice * qty,
        });
    }

    const subtotal = lineItems.reduce((sum, li) => sum + li.total_price, 0);
    const total = Math.max(0, subtotal + shippingCost + invoiceSurcharge - discountAmount);

    // Upsert customer by email
    const shippingCols = { ...addrToColumns(s), first_name: body.firstName, last_name: body.lastName };
    let customerId: string;
    const { data: existing } = await supabaseAdmin
        .from("customers").select("id").eq("email", body.email).limit(1).maybeSingle();
    if (existing) {
        customerId = existing.id;
        await supabaseAdmin.from("customers").update({
            first_name: body.firstName, last_name: body.lastName, phone: body.phone || null,
            language_pref: language, addresses: [shippingCols], updated_at: new Date().toISOString(),
        }).eq("id", customerId);
    } else {
        const { data: created, error: custErr } = await supabaseAdmin.from("customers").insert({
            email: body.email, first_name: body.firstName, last_name: body.lastName,
            phone: body.phone || null, language_pref: language, addresses: [shippingCols],
        }).select("id").single();
        if (custErr || !created) {
            return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
        }
        customerId = created.id;
    }

    // Generate order number DGA-YYYYMMDD-NNN
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const { data: todays } = await supabaseAdmin
        .from("orders").select("id").like("order_number", `DGA-${dateStr}-%`);
    const orderNumber = `DGA-${dateStr}-${String((todays?.length || 0) + 1).padStart(3, "0")}`;

    // Build addresses
    const shippingAddress = { ...addrToColumns(s), first_name: body.firstName, last_name: body.lastName };
    const billingAddress = body.billing
        ? { ...addrToColumns(body.billing), first_name: body.firstName, last_name: body.lastName }
        : shippingAddress;

    const now = new Date();
    const dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Insert order
    const { data: order, error: orderErr } = await supabaseAdmin.from("orders").insert({
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
        language,
        payment_method: "invoice",
        invoice_surcharge: invoiceSurcharge,
        payment_status: "unpaid",
        payment_due_date: dueDate.toISOString(),
        // marks when we attempted the invoice send; actual delivery is tracked in order_communications
        invoice_sent_at: now.toISOString(),
    }).select("id").single();

    if (orderErr || !order) {
        return NextResponse.json({ error: `Failed to create order: ${orderErr?.message || ""}` }, { status: 500 });
    }

    // Insert order items
    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(
        lineItems.map((li) => ({ ...li, order_id: order.id }))
    );
    if (itemsErr) {
        console.error("[Create Order] order_items insert failed:", itemsErr);
        return NextResponse.json({
            success: true,
            orderId: order.id,
            orderNumber,
            warning: "Order created, but line items failed to save — check the order in the database.",
        });
    }

    // Send invoice email
    let warning: string | undefined;
    try {
        const addrStr = `${body.firstName} ${body.lastName}\n${s.street} ${s.houseNumber}\n${s.postalCode} ${s.city}\n${s.country}`;
        const dueDateStr = dueDate.toLocaleDateString(
            language === "de" ? "de-DE" : language === "nl" ? "nl-NL" : "en-GB",
            { day: "2-digit", month: "long", year: "numeric" }
        );
        const html = buildInvoiceEmail({
            orderNumber,
            customerName: body.firstName,
            items: lineItems.map((li) => ({ name: li.product_name, quantity: li.quantity, price: li.unit_price })),
            subtotal,
            shipping: shippingCost,
            discount: discountAmount > 0 ? discountAmount : undefined,
            invoiceSurcharge,
            total,
            shippingAddress: addrStr,
            paymentDueDate: dueDateStr,
            country: s.country,
            locale: language,
        });
        const subjectMap: Record<string, string> = {
            de: `Rechnung #${orderNumber} - Dutch Green Alternative`,
            nl: `Factuur #${orderNumber} - Dutch Green Alternative`,
            en: `Invoice #${orderNumber} - Dutch Green Alternative`,
        };
        const subject = subjectMap[language] || subjectMap.de;
        const sendResult = await sendEmail({ to: body.email, subject, html });
        if (!sendResult.success) {
            const suppressed = "suppressed" in sendResult && sendResult.suppressed;
            warning = suppressed
                ? "Order created. Invoice email skipped — the customer's address is on the suppression list."
                : "Order created, but the invoice email failed to send. Resend it manually.";
        } else {
            const { error: logError } = await supabaseAdmin.from("order_communications").insert({
                order_id: order.id, type: "invoice", subject, recipient: body.email, html,
            });
            if (logError) console.error("[Create Order] Failed to log communication:", logError);
        }
    } catch (e) {
        console.error("[Create Order] Invoice email error:", e);
        warning = "Order created, but the invoice email failed to send. Resend it manually.";
    }

    return NextResponse.json({ success: true, orderId: order.id, orderNumber, warning });
}
