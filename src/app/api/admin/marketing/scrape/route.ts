import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";

// Invokes the edge function and waits for it to accept the job.
// Frontend uses Realtime on budmed_articles to see new articles appear.

export async function POST() {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        // Awaited: a fire-and-forget fetch from a Netlify function is dropped
        // when the function is frozen after responding.
        const res = await fetch(`${supabaseUrl}/functions/v1/marketing-scrape`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({}),
            signal: AbortSignal.timeout(25_000),
        });

        if (!res.ok) {
            console.error("[Marketing Scrape] Edge function returned", res.status);
            return NextResponse.json({ error: `Scrape failed (${res.status})` }, { status: 502 });
        }

        return NextResponse.json({ success: true, message: "Scraping started" });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Scrape failed" },
            { status: 500 }
        );
    }
}
