import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for the support desk.
 *
 * The admin pages reach the ticket tables only through /api/admin/support/*
 * routes using this client. The browser never queries them directly, so the
 * tables can stay locked down (RLS on, no anon grants).
 */
export const supportDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const TICKET_COLUMNS =
    "id, subject, customer_email, customer_name, status, priority, language, order_id, assignee, is_spam, spam_score, spam_reasons, first_replied_at, created_at, updated_at, closed_at";
