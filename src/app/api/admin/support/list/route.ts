import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { supportDb, TICKET_COLUMNS } from "@/lib/support/db";

const PAGE_SIZE = 25;

/**
 * GET /api/admin/support/list
 *
 * The ticket queue: server-side filtering, search and paging, so the browser
 * never loads the whole table (or gets direct database access).
 *
 * Query params: view=open|pending|closed|all|spam, q, assignee, page
 */
export async function GET(req: NextRequest) {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = req.nextUrl.searchParams;
    const view = params.get("view") || "open";
    const q = (params.get("q") || "").trim();
    const assignee = (params.get("assignee") || "").trim();
    const page = Math.max(0, Number(params.get("page")) || 0);

    let query = supportDb
        .from("support_tickets")
        .select(TICKET_COLUMNS, { count: "exact" })
        .order("updated_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    // The spam view is the only one that shows quarantined mail; every other
    // view is the real queue.
    if (view === "spam") {
        query = query.eq("is_spam", true);
    } else {
        query = query.eq("is_spam", false);
        if (view !== "all") query = query.eq("status", view);
    }

    if (assignee) {
        query = assignee === "unassigned" ? query.is("assignee", null) : query.eq("assignee", assignee);
    }

    if (q) {
        // Subject and sender use substring matching — admins type fragments.
        // Message bodies use the full-text index, which is what makes searching
        // 179+ message bodies cheap.
        const escaped = q.replace(/[%,()]/g, " ");
        const { data: bodyHits } = await supportDb
            .from("ticket_messages")
            .select("ticket_id")
            .textSearch("body_text", q, { config: "simple", type: "websearch" })
            .limit(200);

        const ids = [...new Set((bodyHits || []).map((m) => m.ticket_id))];
        const clauses = [
            `subject.ilike.%${escaped}%`,
            `customer_email.ilike.%${escaped}%`,
            `customer_name.ilike.%${escaped}%`,
        ];
        if (ids.length) clauses.push(`id.in.(${ids.join(",")})`);
        query = query.or(clauses.join(","));
    }

    const { data: tickets, count, error } = await query;

    if (error) {
        console.error("[support/list]", error);
        return NextResponse.json({ error: "Failed to load tickets" }, { status: 500 });
    }

    // Message count and latest inbound preview, in one query for the page.
    const ids = (tickets || []).map((t) => t.id);
    const messageCounts: Record<string, number> = {};
    const previews: Record<string, string> = {};

    if (ids.length > 0) {
        const { data: messages } = await supportDb
            .from("ticket_messages")
            .select("ticket_id, direction, body_text, is_internal_note")
            .in("ticket_id", ids)
            .order("created_at", { ascending: false });

        for (const m of messages || []) {
            messageCounts[m.ticket_id] = (messageCounts[m.ticket_id] || 0) + 1;
            if (m.direction === "inbound" && !m.is_internal_note && m.body_text && !previews[m.ticket_id]) {
                previews[m.ticket_id] = m.body_text.replace(/\s+/g, " ").trim().slice(0, 120);
            }
        }
    }

    const counts = await loadCounts();

    return NextResponse.json({
        tickets: (tickets || []).map((t) => ({
            ...t,
            message_count: messageCounts[t.id] || 0,
            body_preview: previews[t.id] || "",
        })),
        counts,
        page,
        pageSize: PAGE_SIZE,
        total: count || 0,
        hasMore: (page + 1) * PAGE_SIZE < (count || 0),
    });
}

function countQuery() {
    return supportDb.from("support_tickets").select("id", { count: "exact", head: true });
}

async function loadCounts() {
    const [all, open, pending, closed, spam] = await Promise.all([
        countQuery().eq("is_spam", false),
        countQuery().eq("is_spam", false).eq("status", "open"),
        countQuery().eq("is_spam", false).eq("status", "pending"),
        countQuery().eq("is_spam", false).eq("status", "closed"),
        countQuery().eq("is_spam", true),
    ]);

    return {
        all: all.count || 0,
        open: open.count || 0,
        pending: pending.count || 0,
        closed: closed.count || 0,
        spam: spam.count || 0,
    };
}
