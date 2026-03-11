import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: "Invalid file type. Allowed: JPEG, PNG, WebP, AVIF" },
                { status: 400 }
            );
        }

        // 5MB limit
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
        }

        const supabase = await createServiceClient();

        // Generate unique filename
        const ext = file.name.split(".").pop() || "jpg";
        const filename = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        const { error: uploadError } = await supabase.storage
            .from("DGA")
            .upload(filename, buffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            console.error("Upload error:", uploadError);
            return NextResponse.json({ error: uploadError.message }, { status: 500 });
        }

        const { data: urlData } = supabase.storage
            .from("DGA")
            .getPublicUrl(filename);

        return NextResponse.json({ url: urlData.publicUrl });
    } catch (err) {
        console.error("Upload handler error:", err);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
