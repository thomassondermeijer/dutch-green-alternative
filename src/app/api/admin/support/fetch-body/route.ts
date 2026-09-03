import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/auth/admin";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/support/fetch-body
 * On-demand fallback: fetches the email body from Resend when the webhook
 * failed to capture it. Updates the ticket_message in the database and
 * returns the body content.
 */
export async function POST(req: NextRequest) {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!RESEND_API_KEY) {
        return NextResponse.json(
            { error: "RESEND_API_KEY not configured" },
            { status: 500 }
        );
    }

    try {
        const { messageId, resendEmailId } = await req.json();

        if (!messageId || !resendEmailId) {
            return NextResponse.json(
                { error: "Missing messageId or resendEmailId" },
                { status: 400 }
            );
        }

        // Fetch from Resend API
        const res = await fetch(
            `https://api.resend.com/emails/receiving/${resendEmailId}`,
            {
                headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
            }
        );

        if (!res.ok) {
            const errBody = await res.text().catch(() => "(no body)");
            console.error(
                `[fetch-body] Failed to fetch email ${resendEmailId}: ${res.status} — ${errBody}`
            );
            return NextResponse.json(
                { error: `Resend API error: ${res.status}` },
                { status: 502 }
            );
        }

        const data = await res.json();
        const bodyText = data.text || "";
        const bodyHtml = data.html || "";

        if (!bodyText && !bodyHtml) {
            return NextResponse.json(
                { error: "Email body still empty in Resend" },
                { status: 404 }
            );
        }

        // Update the ticket_message in DB
        const { error: updateError } = await supabaseAdmin
            .from("ticket_messages")
            .update({
                body_text: bodyText,
                body_html: bodyHtml,
            })
            .eq("id", messageId);

        if (updateError) {
            console.error("[fetch-body] DB update error:", updateError);
            return NextResponse.json(
                { error: "Failed to update message" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            body_text: bodyText,
            body_html: bodyHtml,
        });
    } catch (err) {
        console.error("[fetch-body] Error:", err);
        return NextResponse.json(
            { error: "Internal error" },
            { status: 500 }
        );
    }
}
