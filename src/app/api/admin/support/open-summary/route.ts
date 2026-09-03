import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { supportDb } from "@/lib/support/db";

/**
 * GET /api/admin/support/open-summary
 * The unanswered queue for the dashboard's activity hub. Quarantined mail is
 * excluded — it is not work waiting to be done.
 */
export async function GET() {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supportDb
        .from("support_tickets")
        .select("id, subject, customer_email, customer_name, status, created_at")
        .eq("is_spam", false)
        .in("status", ["open", "pending"])
        .order("created_at", { ascending: false })
        .limit(20);

    if (error) {
        console.error("[support/open-summary]", error);
        return NextResponse.json({ error: "Failed to load tickets" }, { status: 500 });
    }

    return NextResponse.json({ tickets: data || [] });
}
