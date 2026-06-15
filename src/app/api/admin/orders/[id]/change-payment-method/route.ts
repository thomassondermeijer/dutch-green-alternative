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

const VALID_METHODS = ["ideal", "creditcard", "bancontact", "sofortbanking", "invoice"];
const INVOICE_SURCHARGE = 1.99;

// Verify the caller is an admin via their Supabase session (admin_users table),
// the same check the /admin page middleware does. /api/admin/* is not behind it.
async function isAdmin(): Promise<boolean> {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll() { /* read-only: no session mutation needed */ },
            },
        }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return false;
    const { data: adminUser } = await supabaseAdmin
        .from("admin_users")
        .select("id")
        .eq("email", user.email)
        .single();
    return !!adminUser;
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: orderId } = await params;

    if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { paymentMethod?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const newMethod = body.paymentMethod;
    if (!newMethod || !VALID_METHODS.includes(newMethod)) {
        return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

    if (orderError || !order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!["unpaid", "overdue"].includes(order.payment_status)) {
        return NextResponse.json(
            { error: "Payment method can only be changed on unpaid orders" },
            { status: 409 }
        );
    }

    if (newMethod === order.payment_method) {
        return NextResponse.json({ success: true, message: "No change" });
    }

    const isInvoice = newMethod === "invoice";
    const wasInvoice = order.payment_method === "invoice";
    const invoiceSurcharge = isInvoice ? INVOICE_SURCHARGE : 0;
    const num = (v: unknown) => (v != null ? Number(v) : 0);
    const total = num(order.subtotal) + num(order.shipping_cost) + invoiceSurcharge - num(order.discount_amount);

    const now = new Date();
    const update: Record<string, unknown> = {
        payment_method: newMethod,
        invoice_surcharge: invoiceSurcharge,
        total,
        updated_at: now.toISOString(),
    };

    if (isInvoice) {
        update.payment_due_date = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
        update.payment_status = "unpaid";
        update.reminder_count = 0;
        update.last_reminder_at = null;
        update.invoice_sent_at = now.toISOString();
    } else if (wasInvoice) {
        update.payment_due_date = null;
        update.reminder_count = 0;
        update.last_reminder_at = null;
    }

    const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update(update)
        .eq("id", orderId);

    if (updateError) {
        return NextResponse.json({ error: `Update failed: ${updateError.message}` }, { status: 500 });
    }

    let warning: string | undefined;
    if (isInvoice) {
        try {
            const { data: items, error: itemsError } = await supabaseAdmin
                .from("order_items")
                .select("product_name, quantity, unit_price")
                .eq("order_id", orderId);
            if (itemsError) console.error("[Change Payment Method] Failed to load order items:", itemsError);

            const locale = order.language || "de";
            const addr = order.shipping_address;
            if (!addr) {
                console.error("[Change Payment Method] Missing shipping address; skipping invoice email");
                return NextResponse.json({
                    success: true,
                    warning: "Order updated, but the invoice email could not be sent — shipping address is missing.",
                });
            }
            const addrStr = `${addr.first_name} ${addr.last_name}\n${addr.street} ${addr.house_number}\n${addr.postal_code} ${addr.city}\n${addr.country}`;
            const dueDateStr = new Date(update.payment_due_date as string).toLocaleDateString(
                locale === "de" ? "de-DE" : locale === "nl" ? "nl-NL" : "en-GB",
                { day: "2-digit", month: "long", year: "numeric" }
            );

            const html = buildInvoiceEmail({
                orderNumber: order.order_number,
                customerName: addr.first_name,
                items: (items || []).map((i) => ({
                    name: i.product_name,
                    quantity: i.quantity,
                    price: Number(i.unit_price),
                })),
                subtotal: num(order.subtotal),
                shipping: num(order.shipping_cost),
                discount: num(order.discount_amount) > 0 ? num(order.discount_amount) : undefined,
                invoiceSurcharge,
                total,
                shippingAddress: addrStr,
                paymentDueDate: dueDateStr,
                country: addr.country,
                locale,
            });

            const subjectMap: Record<string, string> = {
                de: `Rechnung #${order.order_number} - Dutch Green Alternative`,
                nl: `Factuur #${order.order_number} - Dutch Green Alternative`,
                en: `Invoice #${order.order_number} - Dutch Green Alternative`,
            };
            const subject = subjectMap[locale] || subjectMap.de;

            const sendResult = await sendEmail({ to: order.customer_email, subject, html });
            if (!sendResult.success) {
                const suppressed = "suppressed" in sendResult && sendResult.suppressed;
                warning = suppressed
                    ? "Order updated. Invoice email skipped — the customer's address is on the suppression list."
                    : "Order updated, but the invoice email failed to send. Resend it manually.";
            } else {
                const { error: logError } = await supabaseAdmin.from("order_communications").insert({
                    order_id: orderId,
                    type: "invoice",
                    subject,
                    recipient: order.customer_email,
                    html,
                });
                if (logError) console.error("[Change Payment Method] Failed to log communication:", logError);
            }
        } catch (e) {
            console.error("[Change Payment Method] Invoice email error:", e);
            warning = "Order updated, but the invoice email failed to send. Resend it manually.";
        }
    }

    return NextResponse.json({ success: true, warning });
}
