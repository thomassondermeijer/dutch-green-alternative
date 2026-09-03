/**
 * Backfill the spam verdict over support tickets that predate the filter.
 *
 * Run:  set -a && . ./.env.local && set +a && node scripts/backfill-support-spam.mjs [--apply]
 *
 * Without --apply it is a dry run and writes nothing.
 *
 * These tickets were stored before the webhook captured raw headers, so the
 * header-based layers (auto-submitted, DMARC, bounce detection) cannot run on
 * them. The backfill uses what is available: sender patterns, the SpamAssassin
 * content score, and the same LLM classifier the live cascade uses (via OpenRouter) — the prompt
 * is read from the shared JSON file so the two can never drift apart.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const CLASSIFY_MODEL = "google/gemini-3.7-flash";

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
}
if (!OPENROUTER_KEY) {
    console.error("Missing OPENROUTER_API_KEY — the classifier layer cannot run.");
    process.exit(1);
}

const APPLY = process.argv.includes("--apply");
// --recheck re-runs over tickets already classified, so the backfill can be
// repeated once a previously unavailable layer (e.g. the classifier) works.
const RECHECK = process.argv.includes("--recheck");
const here = dirname(fileURLToPath(import.meta.url));
const { prompt: CLASSIFIER_PROMPT } = JSON.parse(
    readFileSync(join(here, "../src/lib/support/classifier-prompt.json"), "utf8")
);

const OUR_DOMAINS = ["dutchgreenalternative.nl", "dutchgreenalternative.zendesk.com"];
const NOREPLY = [
    "noreply", "no-reply", "no_reply", "donotreply", "do-not-reply",
    "mailer-daemon", "postmaster", "bounce", "bounces", "notifications", "notification",
];

const rest = async (path, init = {}) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...init,
        headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
            ...(init.headers || {}),
        },
    });
    if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
};

const domainOf = (email) => email.split("@").pop()?.toLowerCase().trim() || "";

/** The subset of hard rules that works without stored headers. */
function senderRules(email, subject) {
    const reasons = [];
    const local = email.split("@")[0]?.toLowerCase() || "";
    const domain = domainOf(email);

    if (NOREPLY.some((p) => local === p || local.startsWith(`${p}+`) || local.startsWith(`${p}-`))) {
        reasons.push("noreply_sender");
    }
    if (OUR_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
        reasons.push("mail_loop_own_domain");
    }
    if ((subject.match(/\b(re|aw|fw|fwd|antw)\s*:/gi) || []).length >= 4) {
        reasons.push("subject_loop_nesting");
    }
    if (/\[(possible)?spam\]/i.test(subject)) reasons.push("upstream_spam_flag");
    return reasons;
}

async function spamAssassinScore(from, subject, body) {
    try {
        const email = `From: ${from}\nSubject: ${subject}\n\n${(body || "").slice(0, 40000)}`;
        const res = await fetch("https://spamcheck.postmarkapp.com/filter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, options: "short" }),
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const score = Number(data?.score);
        return data?.success && Number.isFinite(score) ? score : null;
    } catch {
        return null;
    }
}

async function classify(from, subject, body) {
    const userTurn = `FROM: <${from}>
SUBJECT: ${subject}

BODY:
${(body || "").slice(0, 4000)}`;

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${OPENROUTER_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://dutchgreenalternative.nl",
                    "X-Title": "Dutch Green Alternative",
                },
                body: JSON.stringify({
                    model: CLASSIFY_MODEL,
                    messages: [
                        { role: "system", content: CLASSIFIER_PROMPT },
                        { role: "user", content: userTurn },
                    ],
                    max_tokens: 700,
                    temperature: 0,
                    reasoning: { effort: "low" },
                    response_format: { type: "json_object" },
                }),
                signal: AbortSignal.timeout(30000),
            });

            if (res.status === 429) {
                await new Promise((r) => setTimeout(r, 4000 * attempt));
                continue;
            }
            if (!res.ok) {
                console.warn(`  classifier HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
                return null;
            }

            const data = await res.json();
            const raw = data?.choices?.[0]?.message?.content || "";
            return JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim());
        } catch (err) {
            if (attempt === 3) console.warn(`  classifier failed: ${err?.message || err}`);
            await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
    }
    return null;
}

const QUARANTINE = new Set(["spam_or_phishing", "cold_outreach", "vendor_notification", "other_business"]);

async function main() {
    console.log(`Backfilling support spam verdicts — ${APPLY ? "APPLY" : "DRY RUN"}\n`);

    const tickets = await rest(
        "support_tickets?select=id,subject,customer_email,status,spam_checked_at"
        + (RECHECK ? "" : "&spam_checked_at=is.null")
        + "&order=created_at.asc&limit=1000"
    );
    console.log(`${tickets.length} tickets to classify\n`);

    const tally = {};
    let quarantined = 0;

    for (const [i, t] of tickets.entries()) {
        const messages = await rest(
            `ticket_messages?select=body_text&ticket_id=eq.${t.id}&direction=eq.inbound&order=created_at.asc&limit=1`
        );
        const body = messages?.[0]?.body_text || "";
        const email = t.customer_email.toLowerCase();

        // Known customers are never quarantined, same as the live cascade:
        // an order OR a registered account. Several real customers here have an
        // account but no order yet.
        const enc = encodeURIComponent(email);
        const [orders, customers] = await Promise.all([
            rest(`orders?select=id&customer_email=ilike.${enc}&limit=1`),
            rest(`customers?select=id&email=ilike.${enc}&limit=1`),
        ]);
        if (orders.length > 0 || customers.length > 0) {
            tally.allowlisted_customer = (tally.allowlisted_customer || 0) + 1;
            if (APPLY) await markClean(t.id, ["allowlisted_customer"]);
            console.log(`[${i + 1}/${tickets.length}] KEEP  ${email} — known customer`);
            continue;
        }

        const reasons = senderRules(email, t.subject);
        let score = null;
        let category = null;

        // Hard rules settle it on their own: a no-reply sender or a mail loop is
        // never a customer writing in.
        let decisive = reasons.length > 0;
        let suspicious = false;
        if (!decisive) {
            // Only a decisively high score acts alone — SpamAssassin rates
            // ordinary German CBD mail above 5 on keywords, so 5-8 goes to the
            // classifier instead of straight to quarantine.
            score = await spamAssassinScore(email, t.subject, body);
            if (score !== null && score >= 8) {
                decisive = true;
                reasons.push(`spamassassin_${score.toFixed(1)}`);
            } else if (score !== null && score >= 5) {
                suspicious = true;
            }
        }

        let confident = false;
        if (!decisive) {
            const llm = await classify(email, t.subject, body);
            if (llm?.category) {
                category = llm.category;
                confident = Number(llm.confidence) >= (suspicious ? 0.6 : 0.75);
                reasons.push(`llm_${llm.category}${llm.reason ? `: ${llm.reason}` : ""}`);
                if (confident && QUARANTINE.has(category) && suspicious) {
                    reasons.push(`spamassassin_${score.toFixed(1)}`);
                }
            } else if (suspicious) {
                // Fail open: no classifier verdict and only a middling score.
                reasons.push(`spamassassin_unconfirmed_${score.toFixed(1)}`);
            }
        }

        const isSpam = decisive || (confident && category && QUARANTINE.has(category));

        const key = category || reasons[0] || "clean";
        tally[key] = (tally[key] || 0) + 1;
        if (isSpam) quarantined++;

        console.log(
            `[${i + 1}/${tickets.length}] ${isSpam ? "SPAM " : "KEEP "} ${email.padEnd(42)} ${reasons.join("|") || "clean"}`
        );

        if (APPLY) {
            if (isSpam) await markSpam(t.id, reasons, score);
            else await markClean(t.id, reasons.length ? reasons : ["clean"], score);
        }

        // Stay well inside the Gemini free-tier rate limit.
        await new Promise((r) => setTimeout(r, 350));
    }

    console.log("\n── Summary ──");
    for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
        console.log(`${String(v).padStart(4)}  ${k}`);
    }
    console.log(`\n${quarantined}/${tickets.length} quarantined, ${tickets.length - quarantined} left in the queue.`);
    if (!APPLY) console.log("\nDry run — nothing written. Re-run with --apply to save.");
}

const patch = (id, body) =>
    rest(`support_tickets?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(body),
    });

const markSpam = (id, reasons, score) =>
    patch(id, {
        is_spam: true,
        spam_reasons: reasons,
        spam_score: score,
        spam_checked_at: new Date().toISOString(),
        quarantined_at: new Date().toISOString(),
    });

const markClean = (id, reasons, score = null) =>
    patch(id, {
        is_spam: false,
        spam_reasons: reasons,
        spam_score: score,
        spam_checked_at: new Date().toISOString(),
    });

main().catch((err) => {
    console.error("\nBackfill failed:", err);
    process.exit(1);
});
