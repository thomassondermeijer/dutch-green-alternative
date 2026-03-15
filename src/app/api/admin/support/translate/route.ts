import { NextRequest, NextResponse } from "next/server";

const GEMINI_KEY = process.env.GOOGLE_AI_STUDIO_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * POST /api/admin/support/translate
 * Translates text to a target language using Gemini.
 */
export async function POST(req: NextRequest) {
    if (!GEMINI_KEY) {
        return NextResponse.json({ error: "GOOGLE_AI_STUDIO_KEY not configured" }, { status: 500 });
    }

    try {
        const { text, targetLanguage } = await req.json();

        if (!text) {
            return NextResponse.json({ error: "Missing text" }, { status: 400 });
        }

        const langMap: Record<string, string> = {
            en: "English",
            de: "German",
            nl: "Dutch",
        };
        const target = langMap[targetLanguage] || "English";

        const prompt = `Translate the following text to ${target}. Return ONLY the translation, no explanations or markers.

Text to translate:
${text}`;

        const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 1000,
                },
            }),
        });

        if (!res.ok) {
            const error = await res.text();
            console.error("[Translate] Gemini error:", error);
            return NextResponse.json({ error: "Translation failed" }, { status: 500 });
        }

        const data = await res.json();
        const translation = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        return NextResponse.json({ translation: translation.trim() });
    } catch (err) {
        console.error("[Translate]", err);
        return NextResponse.json({ error: "Translation failed" }, { status: 500 });
    }
}
