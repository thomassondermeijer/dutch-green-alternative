import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type EmailType = "marketing" | "transactional";

/**
 * Check if an email is suppressed.
 *
 * - Marketing emails: suppressed for ANY reason (unsubscribed, bounced, complained)
 * - Transactional emails: suppressed only for 'bounced' (can't deliver anyway)
 */
export async function isEmailSuppressed(
    email: string,
    type: EmailType = "marketing"
): Promise<boolean> {
    const query = supabaseAdmin
        .from("email_suppression")
        .select("reason")
        .ilike("email", email);

    if (type === "transactional") {
        query.eq("reason", "bounced");
    }

    const { data } = await query.limit(1);
    return (data && data.length > 0) || false;
}

/**
 * Filter a list of emails, returning only those NOT suppressed.
 */
export async function filterSuppressedEmails(
    emails: string[],
    type: EmailType = "marketing"
): Promise<Set<string>> {
    if (emails.length === 0) return new Set();

    const lowerEmails = emails.map((e) => e.toLowerCase());

    const query = supabaseAdmin
        .from("email_suppression")
        .select("email, reason")
        .in("email", lowerEmails);

    if (type === "transactional") {
        query.eq("reason", "bounced");
    }

    const { data } = await query;

    return new Set((data || []).map((d) => d.email.toLowerCase()));
}
