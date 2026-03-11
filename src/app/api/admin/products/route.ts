import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseFetch(path: string, options: RequestInit = {}) {
    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }
    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        ...options,
        headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
            ...options.headers,
        },
    });
    return res;
}

// GET — list all products
export async function GET() {
    const res = await supabaseFetch("products?order=sort_order.asc,created_at.desc&select=*");
    if (res instanceof NextResponse) return res;
    const data = await res.json();
    return NextResponse.json(data);
}

// POST — create product
export async function POST(req: Request) {
    const body = await req.json();
    const res = await supabaseFetch("products", {
        method: "POST",
        body: JSON.stringify(body),
    });
    if (res instanceof NextResponse) return res;
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });
    return new Response(JSON.stringify(data[0]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
    });
}

// PUT — update product
export async function PUT(req: Request) {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    fields.updated_at = new Date().toISOString();
    const res = await supabaseFetch(`products?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify(fields),
    });
    if (res instanceof NextResponse) return res;
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });
    return new Response(JSON.stringify(data[0]), {
        headers: { "Content-Type": "application/json" },
    });
}

// DELETE — delete product
export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const res = await supabaseFetch(`products?id=eq.${id}`, { method: "DELETE" });
    if (res instanceof NextResponse) return res;
    if (!res.ok) {
        const data = await res.json();
        return NextResponse.json({ error: data }, { status: res.status });
    }
    return NextResponse.json({ success: true });
}
