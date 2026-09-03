"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { describeReason } from "@/lib/support/reasons";
import adminStyles from "../../admin.module.css";
import styles from "../support.module.css";

type Ticket = {
    id: string;
    subject: string;
    customer_email: string;
    customer_name: string | null;
    status: string;
    priority: string;
    language: string;
    order_id: string | null;
    assignee: string | null;
    is_spam: boolean;
    spam_score: number | null;
    spam_reasons: string[];
    created_at: string;
    updated_at: string;
};

type Message = {
    id: string;
    direction: string;
    from_email: string;
    author_email: string | null;
    body_text: string | null;
    body_html: string | null;
    is_ai_generated: boolean;
    is_internal_note: boolean;
    is_auto_reply: boolean;
    created_at: string;
    resend_email_id?: string | null;
    translation?: string;
    fetchingBody?: boolean;
};

type OrderInfo = {
    id: string;
    status: string;
    payment_status: string;
    total: number;
    created_at: string;
    customer_email: string;
    items: { product_name: string; quantity: number; total_price: number }[];
};

type CustomerInfo = {
    orders: { id: string; status: string; payment_status: string; total: number; created_at: string }[];
    orderCount: number;
    lifetimeValue: number;
    otherTickets: { id: string; subject: string; status: string; created_at: string }[];
};

function timeAgo(date: string): string {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
}

export default function TicketDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [order, setOrder] = useState<OrderInfo | null>(null);
    const [customer, setCustomer] = useState<CustomerInfo | null>(null);
    const [reply, setReply] = useState("");
    const [note, setNote] = useState("");
    const [composerTab, setComposerTab] = useState<"reply" | "note">("reply");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [replyIsAi, setReplyIsAi] = useState(false);
    const [translating, setTranslating] = useState<string | null>(null);
    const [aiContext, setAiContext] = useState("");
    const [showAiContext, setShowAiContext] = useState(false);
    const [draftTranslation, setDraftTranslation] = useState<string | null>(null);
    const [draftTranslating, setDraftTranslating] = useState(false);

    const fetchMessageBody = useCallback(async (messageId: string, resendEmailId: string) => {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, fetchingBody: true } : m)));
        try {
            const res = await fetch("/api/admin/support/fetch-body", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messageId, resendEmailId }),
            });
            if (res.ok) {
                const data = await res.json();
                setMessages((prev) => prev.map((m) =>
                    m.id === messageId
                        ? { ...m, body_text: data.body_text, body_html: data.body_html, fetchingBody: false }
                        : m
                ));
                return;
            }
        } catch (err) {
            console.error("[support] Body fetch failed:", err);
        }
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, fetchingBody: false } : m)));
    }, []);

    const loadTicket = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/support/ticket?id=${encodeURIComponent(id)}`);
            if (res.status === 404) {
                router.push("/admin/support");
                return;
            }
            if (!res.ok) throw new Error(`Request failed (${res.status})`);

            const data = await res.json();
            setTicket(data.ticket);
            setMessages(data.messages || []);
            setOrder(data.order);
            setCustomer(data.customer);
            setError(null);

            // Backfill any body the webhook couldn't capture at delivery time.
            for (const msg of (data.messages || []) as Message[]) {
                if (msg.resend_email_id && !msg.body_text && !msg.body_html) {
                    fetchMessageBody(msg.id, msg.resend_email_id);
                }
            }
        } catch (err) {
            console.error("[support] Failed to load ticket:", err);
            setError("Could not load this ticket. Reload to try again.");
        }
        setLoading(false);
    }, [id, router, fetchMessageBody]);

    useEffect(() => { loadTicket(); }, [loadTicket]);

    const patchTicket = async (patch: Record<string, unknown>) => {
        const previous = ticket;
        setTicket((prev) => (prev ? { ...prev, ...patch } as Ticket : prev));
        try {
            const res = await fetch("/api/admin/support/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [id], ...patch }),
            });
            if (!res.ok) throw new Error(`Request failed (${res.status})`);
        } catch (err) {
            console.error("[support] Update failed:", err);
            setTicket(previous);
            setError("That change didn't save. Try again.");
        }
    };

    const setSpam = async (spam: boolean) => {
        try {
            const res = await fetch("/api/admin/support/spam", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [id], spam, scope: spam ? "sender" : "none" }),
            });
            if (!res.ok) throw new Error(`Request failed (${res.status})`);
            if (spam) router.push("/admin/support");
            else await loadTicket();
        } catch (err) {
            console.error("[support] Spam action failed:", err);
            setError("That action didn't go through. Try again.");
        }
    };

    const sendReply = async () => {
        if (!reply.trim() || !ticket) return;
        setSending(true);
        try {
            const res = await fetch("/api/admin/support/reply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticketId: ticket.id, bodyText: reply, isAiGenerated: replyIsAi }),
            });
            if (!res.ok) throw new Error(`Request failed (${res.status})`);
            setReply("");
            setReplyIsAi(false);
            setDraftTranslation(null);
            await loadTicket();
        } catch (err) {
            console.error("[support] Failed to send reply:", err);
            setError("The reply didn't send. Try again.");
        }
        setSending(false);
    };

    const saveNote = async () => {
        if (!note.trim() || !ticket) return;
        setSending(true);
        try {
            const res = await fetch("/api/admin/support/note", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticketId: ticket.id, body: note }),
            });
            if (!res.ok) throw new Error(`Request failed (${res.status})`);
            setNote("");
            await loadTicket();
        } catch (err) {
            console.error("[support] Failed to save note:", err);
            setError("The note didn't save. Try again.");
        }
        setSending(false);
    };

    const generateAiDraft = async () => {
        if (!ticket) return;
        setAiLoading(true);
        try {
            const res = await fetch("/api/admin/support/ai-draft", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ticketId: ticket.id,
                    messages: messages
                        .filter((m) => !m.is_internal_note && !m.is_auto_reply)
                        .map((m) => ({ direction: m.direction, body: m.body_text || "", from: m.from_email })),
                    customerLanguage: ticket.language,
                    adminContext: aiContext.trim() || undefined,
                    orderInfo: order ? {
                        status: order.status,
                        total: order.total,
                        items: order.items.map((i) => i.product_name),
                        paymentStatus: order.payment_status,
                    } : null,
                }),
            });
            const data = await res.json();
            if (data.draft) {
                setReply(data.draft);
                setReplyIsAi(true);
                setComposerTab("reply");
                setDraftTranslation(null);

                if (ticket.language !== "nl" && ticket.language !== "en") {
                    setDraftTranslating(true);
                    try {
                        const trRes = await fetch("/api/admin/support/translate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ text: data.draft, targetLanguage: "nl" }),
                        });
                        const trData = await trRes.json();
                        if (trData.translation) setDraftTranslation(trData.translation);
                    } catch { /* a missing translation shouldn't block the draft */ }
                    setDraftTranslating(false);
                }
            }
        } catch (err) {
            console.error("[support] AI draft failed:", err);
            setError("Couldn't generate a draft. Try again.");
        }
        setAiLoading(false);
    };

    const translateMessage = async (messageId: string, text: string) => {
        setTranslating(messageId);
        try {
            const res = await fetch("/api/admin/support/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, targetLanguage: "nl" }),
            });
            const data = await res.json();
            if (data.translation) {
                setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, translation: data.translation } : m)));
            }
        } catch (err) {
            console.error("[support] Translation failed:", err);
        }
        setTranslating(null);
    };

    if (loading || !ticket) {
        return (
            <div className={adminStyles.pageHeader}>
                <h1 className={adminStyles.pageTitle}>{error ? "Ticket unavailable" : "Loading…"}</h1>
                {error && <div className={adminStyles.error}>{error}</div>}
            </div>
        );
    }

    return (
        <>
            <Link href="/admin/support" className={styles.backLink}>← Back to tickets</Link>

            {ticket.is_spam && (
                <div className={styles.quarantineBanner}>
                    <div>
                        <strong>In quarantine.</strong>{" "}
                        {ticket.spam_reasons?.length > 0 && (
                            <>Filtered because: {ticket.spam_reasons.map(describeReason).join(", ")}
                                {ticket.spam_score !== null && ` (SpamAssassin ${ticket.spam_score})`}.</>
                        )}
                    </div>
                    <button className={styles.notSpamBtn} onClick={() => setSpam(false)}>Not spam — restore</button>
                </div>
            )}

            {error && <div className={adminStyles.error}>{error}</div>}

            <div className={styles.detailHeader}>
                <div>
                    <h1 className={styles.detailSubject}>{ticket.subject}</h1>
                    <div className={styles.detailMeta}>
                        <span>{ticket.customer_name || ticket.customer_email}</span>
                        <span>•</span>
                        <select className={styles.langSelect} value={ticket.language} onChange={(e) => patchTicket({ language: e.target.value })}>
                            <option value="de">🇩🇪 German</option>
                            <option value="nl">🇳🇱 Dutch</option>
                            <option value="en">🇬🇧 English</option>
                            <option value="fr">🇫🇷 French</option>
                            <option value="it">🇮🇹 Italian</option>
                            <option value="es">🇪🇸 Spanish</option>
                        </select>
                        <span>•</span>
                        <span>Created {timeAgo(ticket.created_at)}</span>
                    </div>
                </div>
                <div className={styles.detailActions}>
                    <input
                        className={styles.assigneeInput}
                        placeholder="Unassigned"
                        defaultValue={ticket.assignee || ""}
                        onBlur={(e) => {
                            const value = e.target.value.trim();
                            if (value !== (ticket.assignee || "")) patchTicket({ assignee: value || null });
                        }}
                        aria-label="Assignee"
                    />
                    <select className={styles.selectSmall} value={ticket.status} onChange={(e) => patchTicket({ status: e.target.value })}>
                        <option value="open">🟢 Open</option>
                        <option value="pending">🟡 Pending</option>
                        <option value="closed">⚫ Closed</option>
                    </select>
                    <select className={styles.selectSmall} value={ticket.priority} onChange={(e) => patchTicket({ priority: e.target.value })}>
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">🔴 Urgent</option>
                    </select>
                    {!ticket.is_spam && (
                        <button className={styles.spamBtn} onClick={() => setSpam(true)}>Mark as spam</button>
                    )}
                </div>
            </div>

            {order && (
                <div className={styles.orderCard}>
                    <div className={styles.orderCardTitle}>📦 Linked Order</div>
                    <div className={styles.orderCardGrid}>
                        <div className={styles.orderCardItem}>
                            <div className={styles.orderCardLabel}>Order ID</div>
                            <div className={styles.orderCardValue}>
                                <Link href={`/admin/orders/${order.id}`} className={styles.orderLink}>{order.id.slice(0, 8)}…</Link>
                            </div>
                        </div>
                        <div className={styles.orderCardItem}>
                            <div className={styles.orderCardLabel}>Status</div>
                            <div className={styles.orderCardValue}>{order.status}</div>
                        </div>
                        <div className={styles.orderCardItem}>
                            <div className={styles.orderCardLabel}>Payment</div>
                            <div className={styles.orderCardValue}>{order.payment_status}</div>
                        </div>
                        <div className={styles.orderCardItem}>
                            <div className={styles.orderCardLabel}>Total</div>
                            <div className={styles.orderCardValue}>€{Number(order.total).toFixed(2)}</div>
                        </div>
                        <div className={styles.orderCardItem}>
                            <div className={styles.orderCardLabel}>Products</div>
                            <div className={styles.orderCardValue}>
                                {order.items.map((i) => `${i.product_name} (×${i.quantity})`).join(", ")}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {customer && (customer.orderCount > 0 || customer.otherTickets.length > 0) && (
                <div className={styles.customerCard}>
                    <div className={styles.orderCardTitle}>👤 Customer history</div>
                    <div className={styles.customerStats}>
                        <span><strong>{customer.orderCount}</strong> order{customer.orderCount === 1 ? "" : "s"}</span>
                        <span><strong>€{customer.lifetimeValue.toFixed(2)}</strong> lifetime</span>
                        <span><strong>{customer.otherTickets.length}</strong> other ticket{customer.otherTickets.length === 1 ? "" : "s"}</span>
                    </div>
                    {customer.otherTickets.length > 0 && (
                        <ul className={styles.customerTickets}>
                            {customer.otherTickets.map((t) => (
                                <li key={t.id}>
                                    <Link href={`/admin/support/${t.id}`}>{t.subject}</Link>
                                    <span className={styles.ticketAge}>{t.status} · {timeAgo(t.created_at)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <div className={styles.messageThread}>
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`${styles.message} ${msg.is_internal_note
                            ? styles.messageNote
                            : msg.direction === "inbound" ? styles.messageInbound : styles.messageOutbound}`}
                    >
                        <div className={styles.messageHeader}>
                            <span>
                                <span className={styles.messageSender}>
                                    {msg.is_internal_note
                                        ? `${msg.author_email || "Internal"} · note`
                                        : msg.direction === "inbound"
                                            ? (ticket.customer_name || msg.from_email)
                                            : (msg.author_email && msg.author_email !== "system" ? msg.author_email : "You")}
                                </span>
                                {msg.is_ai_generated && <span className={styles.aiBadge}>AI</span>}
                                {msg.is_auto_reply && <span className={styles.autoBadge}>AUTO</span>}
                            </span>
                            <span>{timeAgo(msg.created_at)}</span>
                        </div>
                        <div className={styles.messageBody}>
                            {msg.fetchingBody ? (
                                <span className={styles.muted}>⏳ Fetching email content from Resend…</span>
                            ) : msg.body_text ? (
                                msg.body_text
                            ) : msg.resend_email_id ? (
                                <span className={styles.muted}>
                                    (Email body not captured){" "}
                                    <button
                                        className={styles.translateBtn}
                                        onClick={() => fetchMessageBody(msg.id, msg.resend_email_id!)}
                                        style={{ display: "inline" }}
                                    >
                                        🔄 Retry fetch
                                    </button>
                                </span>
                            ) : (
                                "(No text content)"
                            )}
                        </div>

                        {msg.direction === "inbound" && !msg.translation && !msg.is_internal_note && (
                            <button
                                className={styles.translateBtn}
                                onClick={() => translateMessage(msg.id, msg.body_text || "")}
                                disabled={translating === msg.id}
                                style={{ marginTop: 8 }}
                            >
                                {translating === msg.id ? "Translating…" : "🌐 Translate to Dutch"}
                            </button>
                        )}

                        {msg.translation && (
                            <div className={styles.translationBox}>
                                <div className={styles.translationLabel}>🇳🇱 Dutch Translation</div>
                                {msg.translation}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {ticket.status !== "closed" && (
                <div className={styles.replyBox}>
                    <div className={styles.composerTabs}>
                        <button
                            className={composerTab === "reply" ? styles.composerTabActive : styles.composerTab}
                            onClick={() => setComposerTab("reply")}
                        >
                            Reply to customer
                        </button>
                        <button
                            className={composerTab === "note" ? styles.composerTabActive : styles.composerTab}
                            onClick={() => setComposerTab("note")}
                        >
                            Internal note
                        </button>
                    </div>

                    {composerTab === "reply" ? (
                        <>
                            <textarea
                                className={styles.replyTextarea}
                                placeholder={`Reply to ${ticket.customer_name || ticket.customer_email}…`}
                                value={reply}
                                onChange={(e) => { setReply(e.target.value); setDraftTranslation(null); }}
                            />

                            {draftTranslating && (
                                <div className={styles.translationBox} style={{ marginTop: 8 }}>
                                    <div className={styles.translationLabel}>⏳ Translating draft to Dutch…</div>
                                </div>
                            )}
                            {draftTranslation && (
                                <div className={styles.translationBox} style={{ marginTop: 8 }}>
                                    <div className={styles.translationLabel}>🇳🇱 Dutch Translation (for your review)</div>
                                    {draftTranslation}
                                </div>
                            )}

                            <div className={styles.aiContextSection}>
                                <button className={styles.aiContextToggle} onClick={() => setShowAiContext(!showAiContext)} type="button">
                                    {showAiContext ? "▾" : "▸"} AI Context / Instructions
                                </button>
                                {showAiContext && (
                                    <textarea
                                        className={styles.aiContextTextarea}
                                        placeholder="Give the AI extra context, e.g. 'Offer coupon OSTERN26', 'Explain we ship from NL in 3-5 days', 'Apologize for delay'…"
                                        value={aiContext}
                                        onChange={(e) => setAiContext(e.target.value)}
                                        rows={3}
                                    />
                                )}
                            </div>

                            <div className={styles.replyActions}>
                                <div className={styles.replyBtnGroup}>
                                    <button className={styles.aiBtn} onClick={generateAiDraft} disabled={aiLoading}>
                                        {aiLoading ? "✨ Generating…" : "✨ AI Draft"}
                                    </button>
                                </div>
                                <button className={styles.sendBtn} onClick={sendReply} disabled={!reply.trim() || sending}>
                                    {sending ? "Sending…" : "Send Reply"}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <textarea
                                className={styles.replyTextarea}
                                placeholder="Note for the team — the customer never sees this."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                            <div className={styles.replyActions}>
                                <span className={styles.muted}>Visible only in the admin.</span>
                                <button className={styles.sendBtn} onClick={saveNote} disabled={!note.trim() || sending}>
                                    {sending ? "Saving…" : "Save note"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {ticket.status === "closed" && (
                <div className={styles.closedNotice}>
                    This ticket is closed.{" "}
                    <button onClick={() => patchTicket({ status: "open" })} className={styles.linkBtn}>Reopen</button>
                </div>
            )}
        </>
    );
}
