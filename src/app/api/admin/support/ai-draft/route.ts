import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { chat, isConfigured, MODELS } from "@/lib/ai/openrouter";

const LANGUAGES: Record<string, string> = {
    de: "German",
    nl: "Dutch",
    en: "English",
    fr: "French",
    it: "Italian",
    es: "Spanish",
};

const SIGN_OFFS: Record<string, string> = {
    de: "Mit freundlichen Grüßen",
    nl: "Met vriendelijke groet",
    en: "Kind regards",
};

type IncomingMessage = { direction: string; body: string; from: string };

/**
 * POST /api/admin/support/ai-draft
 * Drafts a reply for the agent to review, edit and send. Never sends anything.
 */
export async function POST(req: NextRequest) {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isConfigured()) {
        return NextResponse.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 });
    }

    try {
        const { messages, customerLanguage, orderInfo, adminContext } = await req.json();

        const language = LANGUAGES[customerLanguage] || "German";
        const signOff = SIGN_OFFS[customerLanguage] || SIGN_OFFS.en;

        const system = `You are a customer support agent for Dutch Green Alternative, a CBD oil company in the Netherlands.

RULES
1. Write in ${language} — the customer's language.
2. Be professional, warm and direct. Two to four short paragraphs.
3. Use the customer's first name if you know it.
4. Sign off with "${signOff}" followed by "Dutch Green Alternative Team".
5. Use the order context below for anything about orders, shipping or delivery. Never invent an order detail, tracking number or date that isn't given to you.
6. On product questions you may cover dosage (start low, 1-2 drops), quality (organic, lab-tested) and storage (cool and dark).
7. Never make medical claims. CBD is a food supplement — for health questions, recommend speaking to a doctor.
8. If you cannot answer from what you have been given, say what you need from the customer rather than guessing.

Write only the reply body. No subject line, no commentary.`;

        const conversation = (messages as IncomingMessage[] | undefined || [])
            .map((m) => `${m.direction === "inbound" ? "CUSTOMER" : "AGENT"}: ${m.body}`)
            .join("\n\n");

        const orderContext = orderInfo
            ? `ORDER CONTEXT
- Status: ${orderInfo.status}
- Payment: ${orderInfo.paymentStatus}
- Total: €${orderInfo.total}
- Products: ${(orderInfo.items || []).join(", ")}

`
            : "";

        const instructions = adminContext
            ? `INSTRUCTIONS FROM THE AGENT (follow these closely)
${adminContext}

`
            : "";

        const result = await chat({
            model: MODELS.WRITE,
            system,
            prompt: `${orderContext}${instructions}CONVERSATION SO FAR
${conversation}

Write the reply to the customer's most recent message.`,
            temperature: 0.6,
            maxTokens: 2500,
            reasoningEffort: "medium",
            timeoutMs: 45_000,
        });

        if (!result.ok) {
            return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
        }

        return NextResponse.json({ draft: result.text });
    } catch (err) {
        console.error("[support/ai-draft]", err);
        return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
    }
}
