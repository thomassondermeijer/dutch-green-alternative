import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/auth/admin";
import { supportDb } from "@/lib/support/db";
import { emailDomain } from "@/lib/support/headers";

/**
 * POST /api/admin/support/spam
 *
 * Move tickets in or out of quarantine, and teach the filter from the
 * correction. Marking spam can also block the sender or their whole domain;
 * marking not-spam always allowlists the sender, so the same mistake can't
 * repeat.
 *
 * Body: { ids: string[], spam: boolean, scope?: "sender" | "domain" | "none" }
 */
export async function POST(req: NextRequest) {
    const admin = await getAdminEmail();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { ids, spam, scope = "sender" } = await req.json();

        const ticketIds: string[] = Array.isArray(ids) ? ids.filter((v) => typeof v === "string") : [];
        if (ticketIds.length === 0) {
            return NextResponse.json({ error: "No tickets selected" }, { status: 400 });
        }
        if (typeof spam !== "boolean") {
            return NextResponse.json({ error: "Missing 'spam' flag" }, { status: 400 });
        }

        const { data: tickets } = await supportDb
            .from("support_tickets")
            .select("id, customer_email")
            .in("id", ticketIds);

        const emails = [...new Set((tickets || []).map((t) => t.customer_email.toLowerCase()))];

        const { error } = await supportDb
            .from("support_tickets")
            .update({
                is_spam: spam,
                quarantined_at: spam ? new Date().toISOString() : null,
                spam_reasons: spam ? [`manual_by_${admin}`] : [`released_by_${admin}`],
                spam_checked_at: new Date().toISOString(),
                // Releasing something from quarantine puts it back on the queue.
                ...(spam ? {} : { status: "open" }),
                updated_at: new Date().toISOString(),
            })
            .in("id", ticketIds);

        if (error) {
            console.error("[support/spam]", error);
            return NextResponse.json({ error: "Update failed" }, { status: 500 });
        }

        if (spam && scope !== "none") {
            const rows = emails.map((email) => ({
                kind: scope === "domain" ? "domain" : "email",
                value: (scope === "domain" ? emailDomain(email) : email).toLowerCase(),
                reason: "Marked as spam in the support desk",
                created_by: admin,
            })).filter((r) => r.value);

            if (rows.length) {
                // Ignore conflicts: blocking an already-blocked sender is a no-op.
                await supportDb.from("support_blocklist").upsert(rows, {
                    onConflict: "kind,value",
                    ignoreDuplicates: true,
                });
            }
        }

        if (!spam) {
            // A human said this is real. Make sure the cascade never re-quarantines it.
            const rows = emails.map((email) => ({
                kind: "email",
                value: email.toLowerCase(),
                reason: "Released from quarantine in the support desk",
                created_by: admin,
            }));
            if (rows.length) {
                await supportDb.from("support_allowlist").upsert(rows, {
                    onConflict: "kind,value",
                    ignoreDuplicates: true,
                });
                await supportDb.from("support_blocklist").delete().in("value", emails).eq("kind", "email");
            }
        }

        return NextResponse.json({ success: true, updated: ticketIds.length });
    } catch (err) {
        console.error("[support/spam]", err);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
}
