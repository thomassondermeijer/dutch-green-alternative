import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/auth/admin";
import { supportDb } from "@/lib/support/db";

/**
 * POST /api/admin/support/note
 * Add an internal note to a ticket. Notes live in the thread but are never
 * sent — the customer sees nothing.
 */
export async function POST(req: NextRequest) {
    const admin = await getAdminEmail();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { ticketId, body } = await req.json();
        const text = typeof body === "string" ? body.trim() : "";

        if (!ticketId || !text) {
            return NextResponse.json({ error: "Missing ticketId or body" }, { status: 400 });
        }

        const { error } = await supportDb.from("ticket_messages").insert({
            ticket_id: ticketId,
            direction: "outbound",
            from_email: admin,
            author_email: admin,
            body_text: text,
            is_internal_note: true,
        });

        if (error) {
            console.error("[support/note]", error);
            return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
        }

        await supportDb
            .from("support_tickets")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", ticketId);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[support/note]", err);
        return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
    }
}
