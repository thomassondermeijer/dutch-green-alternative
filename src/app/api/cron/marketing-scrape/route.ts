import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Weekly cron: scrape new blog articles from BudMed
// Netlify scheduled function: runs every Monday at 8:00 UTC
// Add to netlify.toml: [functions."api/cron/marketing-scrape"] schedule = "0 8 * * 1"

export async function GET() {
    try {
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Fire-and-forget: invoke edge function
        const res = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/marketing-scrape`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ source: "cron" }),
            }
        );

        if (!res.ok) {
            const text = await res.text();
            console.error("[Cron marketing-scrape] Edge function error:", text.slice(0, 200));
            return NextResponse.json({ error: "Scrape failed" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Weekly blog scrape triggered" });
    } catch (err) {
        console.error("[Cron marketing-scrape]", err);
        return NextResponse.json({ error: "Cron failed" }, { status: 500 });
    }
}
