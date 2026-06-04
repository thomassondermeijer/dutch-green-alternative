import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") || "/de/account";

    if (code) {
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

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && data.user) {
            // Auto-link auth user to existing customer record
            try {
                const supabaseAdmin = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!
                );

                await supabaseAdmin
                    .from("customers")
                    .update({ auth_id: data.user.id })
                    .eq("email", data.user.email!)
                    .is("auth_id", null);
            } catch (e) {
                console.error("[Auth Callback] Failed to link customer:", e);
            }
        }

        if (!error) {
            const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/de/account";
            return NextResponse.redirect(new URL(safeNext, req.url));
        }
    }

    // If something went wrong, redirect to login
    return NextResponse.redirect(new URL("/de/account/login", req.url));
}
