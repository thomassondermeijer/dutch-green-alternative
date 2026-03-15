import { NextRequest, NextResponse } from "next/server";

const GEMINI_KEY = process.env.GOOGLE_AI_STUDIO_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * POST /api/admin/support/ai-draft
 * Generates an AI draft reply using Gemini.
 */
export async function POST(req: NextRequest) {
    if (!GEMINI_KEY) {
        return NextResponse.json({ error: "GOOGLE_AI_STUDIO_KEY not configured" }, { status: 500 });
    }

    try {
        const { messages, customerLanguage, orderInfo } = await req.json();

        const langMap: Record<string, string> = {
            de: "German",
            nl: "Dutch",
            en: "English",
        };
        const lang = langMap[customerLanguage] || "German";

        // Build context
        let orderContext = "";
        if (orderInfo) {
            orderContext = `
CUSTOMER ORDER CONTEXT:
- Order status: ${orderInfo.status}
- Payment status: ${orderInfo.paymentStatus}
- Total: €${orderInfo.total}
- Products: ${orderInfo.items.join(", ")}
`;
        }

        const conversationHistory = messages
            .map((m: { direction: string; body: string; from: string }) =>
                `${m.direction === "inbound" ? "CUSTOMER" : "AGENT"}: ${m.body}`
            )
            .join("\n\n");

        const systemPrompt = `You are a customer support agent for Dutch Green Alternative, a premium CBD oil company based in the Netherlands. 

RULES:
1. Reply in ${lang} (the customer's language).
2. Be professional, warm, and helpful.
3. Keep responses concise — 2-4 short paragraphs max.
4. Use the customer's first name if known.
5. Sign off with "Mit freundlichen Grüßen" (German), "Met vriendelijke groet" (Dutch), or "Kind regards" (English), followed by "Dutch Green Alternative Team".
6. If the customer asks about order status, shipping, or delivery, use the order context provided.
7. For product questions about CBD oil, you can mention: dosage recommendations (start low, 1-2 drops), quality (organic, lab-tested), and storage (cool, dark place).
8. Never make medical claims. If asked about health benefits, mention that CBD is a food supplement and recommend consulting a doctor.

${orderContext}

CONVERSATION SO FAR:
${conversationHistory}

Generate a professional reply to the customer's latest message.`;

        const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 500,
                },
            }),
        });

        if (!res.ok) {
            const error = await res.text();
            console.error("[AI Draft] Gemini error:", error);
            return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
        }

        const data = await res.json();
        const draft = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        return NextResponse.json({ draft: draft.trim() });
    } catch (err) {
        console.error("[AI Draft]", err);
        return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
    }
}
