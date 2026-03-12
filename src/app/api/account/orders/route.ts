import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * GET /api/account/orders
 * Fetch orders for authenticated user (matched by email).
 */
export async function GET() {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll(); },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options);
                        });
                    },
                },
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user?.email) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Get orders by customer email
        const { data: orders, error: ordersError } = await supabaseAdmin
            .from("orders")
            .select(`
                id, order_number, status, total, subtotal, discount_amount,
                shipping_cost, coupon_code, payment_method, payment_status,
                payment_due_date, invoice_surcharge, tracking_number, tracking_url,
                created_at, delivered_at, paid_at
            `)
            .eq("customer_email", user.email)
            .order("created_at", { ascending: false });

        if (ordersError) throw ordersError;

        // Get items for all orders
        const orderIds = (orders || []).map(o => o.id);
        let items: Record<string, { product_name: string; quantity: number; unit_price: number; total_price: number }[]> = {};

        if (orderIds.length > 0) {
            const { data: allItems } = await supabaseAdmin
                .from("order_items")
                .select("order_id, product_name, quantity, unit_price, total_price")
                .in("order_id", orderIds);

            items = (allItems || []).reduce((acc, item) => {
                if (!acc[item.order_id]) acc[item.order_id] = [];
                acc[item.order_id].push(item);
                return acc;
            }, {} as typeof items);
        }

        // Calculate unpaid total
        const unpaidOrders = (orders || []).filter(
            o => o.payment_status === "unpaid" && o.status !== "cancelled"
        );
        const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + Number(o.total), 0);

        return NextResponse.json({
            orders: (orders || []).map(o => ({
                ...o,
                items: items[o.id] || [],
            })),
            unpaidTotal,
            unpaidCount: unpaidOrders.length,
        });
    } catch (err) {
        console.error("[Account Orders]", err);
        return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }
}
