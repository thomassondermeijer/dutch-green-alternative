/**
 * OpenRouter client — the single place the app talks to a language model.
 *
 * One gateway, one key, one place to change models. Everything that used to
 * call Google AI Studio directly goes through here.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = process.env.OPENROUTER_API_KEY || "";

/**
 * Models. Both roles run Gemini 3.7 Flash; the two names are kept so a job can
 * be moved to a different model without touching its call site.
 */
export const MODELS = {
    /** High-volume, low-stakes: spam triage, translation. */
    CLASSIFY: "google/gemini-3.7-flash",
    /** Low-volume, customer-facing: support reply drafts. */
    WRITE: "google/gemini-3.7-flash",
} as const;

export type ChatOptions = {
    /** System prompt — the role and rules. */
    system?: string;
    /** The user turn. */
    prompt: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    /** Ask for a JSON object back. The prompt must still describe the shape. */
    json?: boolean;
    /**
     * How much the model may reason before answering. Gemini 3.x Flash cannot
     * turn reasoning off, and reasoning tokens count against `maxTokens` and
     * are billed as output — "low" roughly halves the cost of a classification
     * call with no measurable loss of accuracy on these tasks.
     */
    reasoningEffort?: "low" | "medium" | "high";
    timeoutMs?: number;
};

export type ChatResult =
    | { ok: true; text: string }
    | { ok: false; error: string };

export function isConfigured(): boolean {
    return API_KEY.length > 0;
}

/**
 * Send one chat completion.
 *
 * Never throws — callers are inbound webhooks and admin actions where a model
 * being unavailable must degrade rather than fail the request.
 */
export async function chat(opts: ChatOptions): Promise<ChatResult> {
    if (!API_KEY) return { ok: false, error: "OPENROUTER_API_KEY not configured" };

    const {
        system,
        prompt,
        model = MODELS.CLASSIFY,
        maxTokens = 1024,
        temperature = 0.2,
        json = false,
        reasoningEffort = "low",
        timeoutMs = 20_000,
    } = opts;

    const messages: { role: string; content: string }[] = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });

    try {
        const res = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json",
                // OpenRouter attributes usage to these; they show up in the dashboard.
                "HTTP-Referer": "https://dutchgreenalternative.nl",
                "X-Title": "Dutch Green Alternative",
            },
            body: JSON.stringify({
                model,
                messages,
                max_tokens: maxTokens,
                temperature,
                reasoning: { effort: reasoningEffort },
                ...(json ? { response_format: { type: "json_object" } } : {}),
            }),
            signal: AbortSignal.timeout(timeoutMs),
        });

        if (!res.ok) {
            const detail = await res.text().catch(() => "");
            console.error(`[openrouter] ${model} returned ${res.status}: ${detail.slice(0, 300)}`);
            return { ok: false, error: `OpenRouter ${res.status}` };
        }

        const data = await res.json();
        const text: string = data?.choices?.[0]?.message?.content || "";
        const finish: string = data?.choices?.[0]?.finish_reason || "";

        if (finish === "length") {
            // Reasoning consumed the budget before the answer was written.
            console.error(`[openrouter] ${model} hit max_tokens (${maxTokens}) — raise it for this call`);
            return { ok: false, error: "Response truncated — max_tokens too low" };
        }
        if (!text.trim()) return { ok: false, error: "Empty response" };

        return { ok: true, text: text.trim() };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[openrouter] ${model} failed:`, message);
        return { ok: false, error: message };
    }
}

/**
 * Chat, then parse the reply as JSON.
 *
 * Tolerates a model that wraps its object in a markdown fence despite being
 * asked not to, and returns null rather than throwing on anything unparseable.
 */
export async function chatJson<T>(opts: Omit<ChatOptions, "json">): Promise<T | null> {
    const result = await chat({ ...opts, json: true });
    if (!result.ok) return null;

    const cleaned = result.text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    try {
        return JSON.parse(cleaned) as T;
    } catch {
        console.error(`[openrouter] Unparseable JSON: ${cleaned.slice(0, 200)}`);
        return null;
    }
}
