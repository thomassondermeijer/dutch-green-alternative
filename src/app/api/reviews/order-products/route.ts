import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/reviews/order-products?token=xxx&locale=de
 * Returns the products from the order so the customer can select which to review.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const locale = searchParams.get("locale") || "de";

    if (!token) return NextResponse.json({ products: [] }, { status: 400 });

    // Find order by token
    const { data: order } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("review_token", token)
        .single();

    if (!order) return NextResponse.json({ products: [] }, { status: 404 });

    // Check if already reviewed
    const { data: existing } = await supabaseAdmin
        .from("reviews")
        .select("id")
        .eq("order_id", order.id)
        .maybeSingle();

    if (existing) return NextResponse.json({ products: [], already_reviewed: true });

    // Get order items with product info
    const { data: items } = await supabaseAdmin
        .from("order_items")
        .select("product_id, quantity, products(slug, translations)")
        .eq("order_id", order.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const products = (items || []).map((item: any) => {
        const p = item.products;
        const translations = p?.translations as Record<string, { name?: string }> | undefined;
        const name = translations?.[locale]?.name || translations?.de?.name || "CBD Product";
        return { id: item.product_id, name, slug: p?.slug || "" };
    });

    return NextResponse.json({ products });
}
