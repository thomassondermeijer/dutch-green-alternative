import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/auth/admin";
import { supportDb } from "@/lib/support/db";

const STATUSES = ["open", "pending", "closed"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const LANGUAGES = ["nl", "de", "en", "fr", "it", "es"];

/**
 * POST /api/admin/support/update
 * Update the workflow fields on one or more tickets.
 *
 * Body: { ids: string[], status?, priority?, language?, assignee? }
 * `assignee: null` unassigns.
 */
export async function POST(req: NextRequest) {
    const admin = await getAdminEmail();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { ids, status, priority, language, assignee } = await req.json();

        const ticketIds: string[] = Array.isArray(ids) ? ids.filter((v) => typeof v === "string") : [];
        if (ticketIds.length === 0) {
            return NextResponse.json({ error: "No tickets selected" }, { status: 400 });
        }

        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (status !== undefined) {
            if (!STATUSES.includes(status)) {
                return NextResponse.json({ error: `Unknown status: ${status}` }, { status: 400 });
            }
            patch.status = status;
            patch.closed_at = status === "closed" ? new Date().toISOString() : null;
        }
        if (priority !== undefined) {
            if (!PRIORITIES.includes(priority)) {
                return NextResponse.json({ error: `Unknown priority: ${priority}` }, { status: 400 });
            }
            patch.priority = priority;
        }
        if (language !== undefined) {
            if (!LANGUAGES.includes(language)) {
                return NextResponse.json({ error: `Unknown language: ${language}` }, { status: 400 });
            }
            patch.language = language;
        }
        if (assignee !== undefined) {
            patch.assignee = assignee === null || assignee === "" ? null : String(assignee);
        }

        if (Object.keys(patch).length === 1) {
            return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
        }

        const { error } = await supportDb.from("support_tickets").update(patch).in("id", ticketIds);
        if (error) {
            console.error("[support/update]", error);
            return NextResponse.json({ error: "Update failed" }, { status: 500 });
        }

        return NextResponse.json({ success: true, updated: ticketIds.length });
    } catch (err) {
        console.error("[support/update]", err);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
}
