import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * POST /api/account/link-customer
 * Auto-link authenticated user to their customer record (by email).
 * Called from client after login.
 */
export async function POST(req: NextRequest) {
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
        if (authError || !user) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Link auth_id to customer record if not already linked
        const { data: customer } = await supabaseAdmin
            .from("customers")
            .select("id, auth_id")
            .eq("email", user.email!)
            .maybeSingle();

        if (customer && !customer.auth_id) {
            await supabaseAdmin
                .from("customers")
                .update({ auth_id: user.id })
                .eq("id", customer.id);
        }

        return NextResponse.json({ success: true, linked: !!customer });
    } catch (err) {
        console.error("[Link Customer]", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
