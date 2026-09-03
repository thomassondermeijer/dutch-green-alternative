import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyUnsubscribe } from "@/lib/marketing/unsubscribe-token";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Record the opt-out. Idempotent — an address that unsubscribes twice, or that
 * clicks the link after a provider already one-clicked it, is not an error.
 */
async function suppress(email: string, source: string): Promise<boolean> {
    const address = email.trim().toLowerCase();

    const { data: existing } = await supabaseAdmin
        .from("email_suppression")
        .select("id")
        .ilike("email", address)
        .eq("reason", "unsubscribed")
        .limit(1);

    if (existing?.length) {
        console.log(`[unsubscribe] ${address} was already unsubscribed (${source})`);
        return true;
    }

    const { error } = await supabaseAdmin
        .from("email_suppression")
        .insert({ email: address, reason: "unsubscribed", source });

    if (error) {
        console.error("[unsubscribe] Failed to record:", error);
        return false;
    }

    console.log(`[unsubscribe] ${address} unsubscribed via ${source}`);
    return true;
}

function readParams(req: NextRequest): { email: string; token: string } {
    const p = req.nextUrl.searchParams;
    return { email: (p.get("e") || "").trim(), token: (p.get("t") || "").trim() };
}

/**
 * POST /api/unsubscribe?e=<email>&t=<token>
 *
 * Two callers, one behaviour — unsubscribe immediately, no confirmation step:
 *
 *  1. Gmail / Yahoo / Apple Mail one-click (RFC 8058). They POST here with a
 *     `List-Unsubscribe=One-Click` form body when the user presses the native
 *     Unsubscribe button. Providers require this to complete without any
 *     further interaction, and they check it works.
 *  2. Our own confirmation page, once the person has clicked Confirm.
 *
 * It is deliberately POST-only for the act of unsubscribing: link scanners and
 * mail-client prefetchers issue GETs, and a GET that unsubscribed would opt
 * people out of a newsletter they never chose to leave.
 */
export async function POST(req: NextRequest) {
    const { email, token } = readParams(req);

    if (!email || !token || !verifyUnsubscribe(email, token)) {
        console.warn(`[unsubscribe] Rejected bad or missing signature for "${email}"`);
        return NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 400 });
    }

    // Distinguish the provider's one-click POST from our page's, for the audit trail.
    const contentType = req.headers.get("content-type") || "";
    let source = "one_click";
    if (contentType.includes("application/x-www-form-urlencoded")) {
        const body = await req.text().catch(() => "");
        source = body.includes("One-Click") ? "rfc8058_one_click" : "one_click";
    } else {
        source = "unsubscribe_page";
    }

    const ok = await suppress(email, source);
    if (!ok) {
        return NextResponse.json({ error: "Could not process unsubscribe" }, { status: 500 });
    }

    // Providers only check for a 2xx; they don't read the body.
    return NextResponse.json({ success: true });
}

/**
 * GET is intentionally inert — it reports whether the link is valid so the
 * confirmation page can render the right thing, and never changes anything.
 */
export async function GET(req: NextRequest) {
    const { email, token } = readParams(req);
    const valid = Boolean(email && token && verifyUnsubscribe(email, token));
    return NextResponse.json({ valid, email: valid ? email : null });
}
