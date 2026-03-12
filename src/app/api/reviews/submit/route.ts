import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/reviews/submit
 * Submit a customer review with optional photo uploads.
 */
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const token = formData.get("token") as string;
        const rating = parseInt(formData.get("rating") as string);
        const text = formData.get("text") as string;
        const productId = formData.get("product_id") as string;
        const customerName = formData.get("customer_name") as string;

        if (!token || !rating || rating < 1 || rating > 5) {
            return NextResponse.json({ error: "Token and valid rating (1-5) required" }, { status: 400 });
        }

        // Validate token → find order
        const { data: order, error: orderErr } = await supabaseAdmin
            .from("orders")
            .select("id, customer_email, order_number, shipping_address")
            .eq("review_token", token)
            .single();

        if (orderErr || !order) {
            return NextResponse.json({ error: "Invalid or expired review link" }, { status: 404 });
        }

        // Check if already reviewed this order
        const { data: existing } = await supabaseAdmin
            .from("reviews")
            .select("id")
            .eq("order_id", order.id)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ error: "You have already submitted a review for this order" }, { status: 409 });
        }

        // Upload images (up to 3)
        const imageUrls: string[] = [];
        for (let i = 0; i < 3; i++) {
            const file = formData.get(`image_${i}`) as File | null;
            if (!file || file.size === 0) continue;

            // Validate file type
            if (!file.type.startsWith("image/")) continue;
            // Max 5MB
            if (file.size > 5 * 1024 * 1024) continue;

            const ext = file.type.includes("png") ? "png" : "jpg";
            const fileName = `reviews/${order.id}-${i}-${Date.now()}.${ext}`;
            const buffer = new Uint8Array(await file.arrayBuffer());

            const { error: uploadErr } = await supabaseAdmin.storage
                .from("DGA")
                .upload(fileName, buffer, { contentType: file.type, upsert: true });

            if (!uploadErr) {
                const { data: urlData } = supabaseAdmin.storage.from("DGA").getPublicUrl(fileName);
                imageUrls.push(urlData.publicUrl);
            }
        }

        // Determine customer name
        const addr = order.shipping_address as Record<string, string> | null;
        const name = customerName ||
            `${addr?.first_name || ""} ${addr?.last_name || ""}`.trim() ||
            order.customer_email.split("@")[0];

        // Create review
        const { error: insertErr } = await supabaseAdmin.from("reviews").insert({
            product_id: productId || null,
            customer_email: order.customer_email,
            customer_name: name,
            rating,
            text: text || null,
            image_urls: imageUrls,
            order_id: order.id,
            review_token: token,
            verified_purchase: true,
            is_approved: false,
            language: (formData.get("language") as string) || "de",
        });

        if (insertErr) {
            console.error("[Review Submit]", insertErr);
            return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
        }

        // Invalidate token so it can't be reused
        await supabaseAdmin.from("orders").update({ review_token: null }).eq("id", order.id);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[Review Submit]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
