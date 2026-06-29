import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

type AddrRow = { street?: string; house_number?: string; postal_code?: string; city?: string; country?: string };

export async function GET(req: NextRequest) {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const raw = (req.nextUrl.searchParams.get("q") || "").trim();
    if (raw.length < 2) {
        return NextResponse.json({ results: [] });
    }
    // Strip characters that would break the PostgREST .or() filter or inject wildcards.
    const q = raw.replace(/[%,()*]/g, " ").trim();
    if (q.length < 2) {
        return NextResponse.json({ results: [] });
    }
    const pattern = `%${q}%`;

    const { data, error } = await supabaseAdmin
        .from("customers")
        .select("email, first_name, last_name, phone, language_pref, addresses")
        .or(`email.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`)
        .order("created_at", { ascending: false })
        .limit(10);

    if (error) {
        console.error("[Customer Search] query error:", error);
        return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    const results = (data || []).map((c) => {
        const addrs = Array.isArray(c.addresses) ? (c.addresses as AddrRow[]) : [];
        const a = addrs.length > 0 ? addrs[0] : null;
        const language = ["de", "nl", "en"].includes(c.language_pref) ? c.language_pref : "de";
        return {
            email: c.email,
            firstName: c.first_name || "",
            lastName: c.last_name || "",
            phone: c.phone || "",
            language,
            address: a
                ? {
                    street: a.street || "",
                    houseNumber: a.house_number || "",
                    postalCode: a.postal_code || "",
                    city: a.city || "",
                    country: a.country || "DE",
                }
                : null,
        };
    });

    return NextResponse.json({ results });
}
