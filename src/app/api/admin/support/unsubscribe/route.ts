import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/auth/admin";
import { supportDb } from "@/lib/support/db";

/**
 * POST /api/admin/support/unsubscribe
 *
 * Suppress a customer's marketing email from their ticket.
 *
 * The inbound webhook already detects unsubscribe requests written in Dutch,
 * German or English and honours them on arrival. This is the manual path for
 * the ones it misses — a request phrased unusually, or buried mid-paragraph in
 * a longer message. Without it an agent who spots one has no way to act on it
 * inside the app.
 *
 * Body: { ticketId: string }
 */
export async function POST(req: NextRequest) {
    const admin = await getAdminEmail();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { ticketId } = await req.json();
        if (!ticketId) {
            return NextResponse.json({ error: "Missing ticketId" }, { status: 400 });
        }

        // Read the address from the ticket rather than the request body — the
        // caller shouldn't be able to suppress an arbitrary address.
        const { data: ticket } = await supportDb
            .from("support_tickets")
            .select("id, customer_email")
            .eq("id", ticketId)
            .maybeSingle();

        if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

        const email = ticket.customer_email.toLowerCase();

        const { data: existing } = await supportDb
            .from("email_suppression")
            .select("id, reason, created_at")
            .ilike("email", email)
            .eq("reason", "unsubscribed")
            .limit(1);

        if (existing?.length) {
            return NextResponse.json({
                success: true,
                alreadySuppressed: true,
                since: existing[0].created_at,
            });
        }

        const { error } = await supportDb.from("email_suppression").insert({
            email,
            reason: "unsubscribed",
            source: `support_ticket:${ticketId} (manual, by ${admin})`,
        });

        if (error) {
            console.error("[support/unsubscribe]", error);
            return NextResponse.json({ error: "Could not record the unsubscribe" }, { status: 500 });
        }

        // Leave the reason in the thread so the next person can see why this
        // customer stopped receiving marketing, and who decided it.
        await supportDb.from("ticket_messages").insert({
            ticket_id: ticketId,
            direction: "outbound",
            from_email: admin,
            author_email: admin,
            is_internal_note: true,
            body_text: `${admin} unsubscribed ${email} from marketing email. Transactional mail about orders is unaffected.`,
        });

        await supportDb
            .from("support_tickets")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", ticketId);

        console.log(`[support/unsubscribe] ${admin} suppressed ${email} from ticket ${ticketId}`);
        return NextResponse.json({ success: true, alreadySuppressed: false });
    } catch (err) {
        console.error("[support/unsubscribe]", err);
        return NextResponse.json({ error: "Could not record the unsubscribe" }, { status: 500 });
    }
}
