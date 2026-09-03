import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Strip any depth of reply/forward prefixes, in the languages this inbox sees. */
export function normalizeSubject(subject: string): string {
    let s = (subject || "").trim();
    let previous: string;
    do {
        previous = s;
        s = s.replace(/^\s*(re|aw|fw|fwd|antw|vs|sv)\s*(\[\d+\])?\s*:\s*/i, "");
    } while (s !== previous);
    return s.trim();
}

export type ThreadMatch = {
    ticketId: string;
    /** How the message was threaded — recorded so mis-threading is diagnosable. */
    via: "references" | "subject" | "none";
};

/**
 * Find the ticket an inbound message belongs to.
 *
 * Order matters: RFC 5322 References/In-Reply-To is authoritative because the
 * sending mail client built it from our own Message-IDs. Subject matching is a
 * fallback for clients that drop those headers, and it is scoped to the same
 * sender and an exact normalized-subject match.
 *
 * There is deliberately no "just use their most recent open ticket" fallback:
 * that silently buried new questions inside unrelated older threads.
 */
export async function findThread(
    customerEmail: string,
    subject: string,
    referencedMessageIds: string[]
): Promise<ThreadMatch> {
    // 1. Threading headers — authoritative.
    if (referencedMessageIds.length > 0) {
        const { data } = await supabaseAdmin
            .from("ticket_messages")
            .select("ticket_id")
            .in("message_id", referencedMessageIds)
            .order("created_at", { ascending: false })
            .limit(1);

        if (data?.length) return { ticketId: data[0].ticket_id, via: "references" };
    }

    // 2. Same sender, same subject, still being worked on.
    const normalized = normalizeSubject(subject);
    if (normalized) {
        const { data } = await supabaseAdmin
            .from("support_tickets")
            .select("id, subject")
            .ilike("customer_email", customerEmail)
            .in("status", ["open", "pending"])
            .eq("is_spam", false)
            .order("updated_at", { ascending: false })
            .limit(20);

        const hit = (data || []).find(
            (t) => normalizeSubject(t.subject).toLowerCase() === normalized.toLowerCase()
        );
        if (hit) return { ticketId: hit.id, via: "subject" };
    }

    return { ticketId: "", via: "none" };
}

/**
 * Build a Message-ID for an outbound reply so the customer's mail client
 * threads it, and so their reply comes back with a References header we can
 * match on.
 */
export function buildMessageId(ticketId: string, domain = "dutchgreenalternative.nl"): string {
    const rand = Math.random().toString(36).slice(2, 10);
    return `${ticketId}.${Date.now().toString(36)}.${rand}@${domain}`;
}
