import { NextRequest, NextResponse } from "next/server";
import { createClient, type EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// The public host the user actually requested. On Netlify/proxies, req.url inside
// a serverless function is the INTERNAL deploy URL (<deploy>--site.netlify.app),
// so redirecting against it bounces the user onto that permalink. x-forwarded-host
// carries the real public host (dutchgreenalternative.nl).
function getPublicOrigin(req: NextRequest): string {
    const forwardedHost = req.headers.get("x-forwarded-host");
    const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
    if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
    return new URL(req.url).origin;
}

// Token-hash email-verification handler (magic link, password recovery, signup
// confirmation). verifyOtp does NOT require a client-side code_verifier, so the
// link works regardless of which browser/device opens the email.
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;
    const next = searchParams.get("next") || "/de/account";
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/de/account";
    const origin = getPublicOrigin(req);

    if (token_hash && type) {
        const cookieStore = await cookies();
        // Build the redirect up front so the session cookies verifyOtp issues are
        // written onto THIS response (a redirect created afterwards wouldn't carry them).
        const response = NextResponse.redirect(new URL(safeNext, origin));
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll(); },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options);
                            response.cookies.set(name, value, options);
                        });
                    },
                },
            }
        );

        const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });

        if (!error && data.user) {
            // Auto-link auth user to existing customer record (mirrors /auth/callback)
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
                console.error("[Auth Confirm] Failed to link customer:", e);
            }
        }

        if (!error) {
            return response;
        }

        // Surface the verification error so it can be diagnosed from the URL.
        console.error("[Auth Confirm] verifyOtp failed:", error.status, error.message);
        return NextResponse.redirect(
            new URL(`/de/account/login?auth_error=${encodeURIComponent(error.message)}`, origin)
        );
    }

    return NextResponse.redirect(new URL("/de/account/login?auth_error=missing_token", origin));
}
