import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { supportDb, TICKET_COLUMNS } from "@/lib/support/db";

/**
 * GET /api/admin/support/ticket?id=...
 * One ticket with its full thread, the linked order, and the customer's history.
 */
export async function GET(req: NextRequest) {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { data: ticket, error } = await supportDb
        .from("support_tickets")
        .select(TICKET_COLUMNS)
        .eq("id", id)
        .maybeSingle();

    if (error) {
        console.error("[support/ticket]", error);
        return NextResponse.json({ error: "Failed to load ticket" }, { status: 500 });
    }
    if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: messages } = await supportDb
        .from("ticket_messages")
        .select("id, direction, from_email, author_email, body_text, body_html, is_ai_generated, is_internal_note, is_auto_reply, resend_email_id, created_at")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });

    // Linked order, with its line items.
    let order = null;
    if (ticket.order_id) {
        const { data: orderData } = await supportDb
            .from("orders")
            .select("id, status, payment_status, total, created_at, customer_email, shipping_address")
            .eq("id", ticket.order_id)
            .maybeSingle();

        if (orderData) {
            const { data: items } = await supportDb
                .from("order_items")
                .select("product_name, quantity, total_price")
                .eq("order_id", orderData.id);
            order = { ...orderData, items: items || [] };
        }
    }

    // Customer context: orders, other tickets, and whether they still receive
    // marketing — the agent needs to know that before promising anything.
    const [{ data: allOrders }, { data: otherTickets }, { data: suppression }] = await Promise.all([
        supportDb
            .from("orders")
            .select("id, status, payment_status, total, created_at")
            .ilike("customer_email", ticket.customer_email)
            .order("created_at", { ascending: false })
            .limit(10),
        supportDb
            .from("support_tickets")
            .select("id, subject, status, created_at")
            .ilike("customer_email", ticket.customer_email)
            .eq("is_spam", false)
            .neq("id", id)
            .order("created_at", { ascending: false })
            .limit(10),
        supportDb
            .from("email_suppression")
            .select("reason, source, created_at")
            .ilike("email", ticket.customer_email)
            .order("created_at", { ascending: false })
            .limit(1),
    ]);

    const orders = allOrders || [];
    const lifetimeValue = orders
        .filter((o) => o.payment_status === "paid")
        .reduce((sum, o) => sum + Number(o.total || 0), 0);

    return NextResponse.json({
        ticket,
        messages: messages || [],
        order,
        customer: {
            orders,
            orderCount: orders.length,
            lifetimeValue,
            otherTickets: otherTickets || [],
            suppression: suppression?.[0] || null,
        },
    });
}
