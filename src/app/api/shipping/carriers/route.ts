import { NextResponse } from "next/server";

const ACUT_API_URL = process.env.ACUT_API_URL || "https://api.wms.acut-services.de/v1";
const ACUT_API_KEY = process.env.ACUT_API_KEY!;
const ACUT_USERNAME = process.env.ACUT_USERNAME!;
const ACUT_PASSWORD = process.env.ACUT_PASSWORD!;

/**
 * GET /api/shipping/carriers
 * Fetches available shipping carriers from Acut WMS.
 */
export async function GET() {
    try {
        const basicAuth = Buffer.from(`${ACUT_USERNAME}:${ACUT_PASSWORD}`).toString("base64");

        const res = await fetch(`${ACUT_API_URL}/carriers`, {
            headers: {
                "Accept": "application/json",
                "X-ACUT-API-KEY": ACUT_API_KEY,
                "Authorization": `Basic ${basicAuth}`,
            },
            next: { revalidate: 300 }, // Cache for 5 minutes
        });

        if (!res.ok) {
            console.error("[Acut Carriers] Error:", res.status);
            return NextResponse.json({ carriers: [] });
        }

        const data = await res.json();
        const carriers = (data.data || []).map((c: { id: number; title: string }) => ({
            id: c.id,
            title: c.title,
        }));

        return NextResponse.json({ carriers });
    } catch (err) {
        console.error("[Acut Carriers] Fetch error:", err);
        return NextResponse.json({ carriers: [] });
    }
}
