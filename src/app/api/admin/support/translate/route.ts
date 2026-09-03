import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { chat, isConfigured, MODELS } from "@/lib/ai/openrouter";

const LANGUAGES: Record<string, string> = {
    en: "English",
    de: "German",
    nl: "Dutch",
    fr: "French",
    it: "Italian",
    es: "Spanish",
};

/**
 * POST /api/admin/support/translate
 * Translates a support message into the target language.
 */
export async function POST(req: NextRequest) {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isConfigured()) {
        return NextResponse.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 });
    }

    try {
        const { text, targetLanguage } = await req.json();

        if (typeof text !== "string" || !text.trim()) {
            return NextResponse.json({ error: "Missing text" }, { status: 400 });
        }

        const target = LANGUAGES[targetLanguage] || "English";

        const result = await chat({
            model: MODELS.CLASSIFY,
            system: `You are a translator for a Dutch CBD webshop's support desk. Translate the user's text into ${target}. Return only the translation — no preamble, no quotes, no notes. Preserve line breaks, names, order numbers and product names exactly as they appear.`,
            prompt: text.slice(0, 8000),
            temperature: 0.2,
            maxTokens: 3000,
        });

        if (!result.ok) {
            return NextResponse.json({ error: "Translation failed" }, { status: 502 });
        }

        return NextResponse.json({ translation: result.text });
    } catch (err) {
        console.error("[support/translate]", err);
        return NextResponse.json({ error: "Translation failed" }, { status: 500 });
    }
}
