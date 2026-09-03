import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Resolve the signed-in admin from the request cookies.
 *
 * Every /api/admin route must gate on this. The admin pages talk to the
 * database through these routes (service role) rather than the browser
 * Supabase client, so this check is the only thing standing between the
 * public internet and customer data.
 *
 * Returns the admin's email, or null when the caller isn't an admin.
 */
export async function getAdminEmail(): Promise<string | null> {
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
    if (!user?.email) return null;

    const { data: adminUser } = await supabaseAdmin
        .from("admin_users")
        .select("id")
        .eq("email", user.email)
        .single();

    return adminUser ? user.email : null;
}

export async function isAdmin(): Promise<boolean> {
    return (await getAdminEmail()) !== null;
}
