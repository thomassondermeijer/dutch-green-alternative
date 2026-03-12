import { NextResponse } from "next/server";

// Fire-and-forget: invokes the edge function, returns immediately.
// Frontend uses Realtime on budmed_articles to see new articles appear.

export async function POST() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        fetch(`${supabaseUrl}/functions/v1/marketing-scrape`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({}),
        }).catch(err => console.error("[Marketing Scrape] Edge function invoke failed:", err));

        return NextResponse.json({ success: true, message: "Scraping started" });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Scrape failed" },
            { status: 500 }
        );
    }
}
