"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
    created_at: string;
    updated_at: string;
};

type Message = {
    id: string;
    direction: string;
    from_email: string;
    body_text: string | null;
    body_html: string | null;
    is_ai_generated: boolean;
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
    shipping_address: { first_name?: string; last_name?: string; city?: string; country?: string } | null;
    items: { product_name: string; quantity: number; total_price: number }[];
};

const LANG_FLAGS: Record<string, string> = { de: "🇩🇪", nl: "🇳🇱", en: "🇬🇧" };
const LANG_NAMES: Record<string, string> = { de: "German", nl: "Dutch", en: "English" };

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
    const [reply, setReply] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [translating, setTranslating] = useState<string | null>(null);
    const [aiContext, setAiContext] = useState("");
    const [showAiContext, setShowAiContext] = useState(false);

    const loadTicket = useCallback(async () => {
        const supabase = createClient();

        const { data: ticketData } = await supabase
            .from("support_tickets")
            .select("*")
            .eq("id", id)
            .single();

        if (!ticketData) {
            router.push("/admin/support");
            return;
        }
        setTicket(ticketData);

        // Load messages
        const { data: msgs } = await supabase
            .from("ticket_messages")
            .select("*")
            .eq("ticket_id", id)
            .order("created_at", { ascending: true });
        const loadedMsgs = (msgs || []) as Message[];
        setMessages(loadedMsgs);

        // Auto-fetch missing bodies for messages with resend_email_id
        const missingBody = loadedMsgs.filter(
            (m) => m.resend_email_id && !m.body_text && !m.body_html
        );
        if (missingBody.length > 0) {
            for (const msg of missingBody) {
                fetchMessageBody(msg.id, msg.resend_email_id!);
            }
        }

        // Load linked order
        if (ticketData.order_id) {
            const { data: orderData } = await supabase
                .from("orders")
                .select("id, status, payment_status, total, created_at, customer_email, shipping_address")
                .eq("id", ticketData.order_id)
                .single();

            if (orderData) {
                const { data: items } = await supabase
                    .from("order_items")
                    .select("product_name, quantity, total_price")
                    .eq("order_id", orderData.id);

                setOrder({ ...orderData, items: items || [] } as OrderInfo);
            }
        }

        setLoading(false);
    }, [id, router]);

    useEffect(() => {
        loadTicket();
    }, [loadTicket]);

    const fetchMessageBody = async (messageId: string, resendEmailId: string) => {
        setMessages((prev) =>
            prev.map((m) => m.id === messageId ? { ...m, fetchingBody: true } : m)
        );

        try {
            const res = await fetch("/api/admin/support/fetch-body", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messageId, resendEmailId }),
            });

            if (res.ok) {
                const data = await res.json();
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === messageId
                            ? { ...m, body_text: data.body_text, body_html: data.body_html, fetchingBody: false }
                            : m
                    )
                );
            } else {
                setMessages((prev) =>
                    prev.map((m) => m.id === messageId ? { ...m, fetchingBody: false } : m)
                );
            }
        } catch {
            setMessages((prev) =>
                prev.map((m) => m.id === messageId ? { ...m, fetchingBody: false } : m)
            );
        }
    };

    const updateStatus = async (newStatus: string) => {
        const supabase = createClient();
        await supabase
            .from("support_tickets")
            .update({
                status: newStatus,
                updated_at: new Date().toISOString(),
                ...(newStatus === "closed" ? { closed_at: new Date().toISOString() } : {}),
            })
            .eq("id", id);
        setTicket((prev) => prev ? { ...prev, status: newStatus } : prev);
    };

    const updatePriority = async (newPriority: string) => {
        const supabase = createClient();
        await supabase.from("support_tickets").update({ priority: newPriority }).eq("id", id);
        setTicket((prev) => prev ? { ...prev, priority: newPriority } : prev);
    };

    const updateLanguage = async (newLang: string) => {
        const supabase = createClient();
        await supabase.from("support_tickets").update({ language: newLang }).eq("id", id);
        setTicket((prev) => prev ? { ...prev, language: newLang } : prev);
    };

    const sendReply = async () => {
        if (!reply.trim() || !ticket) return;
        setSending(true);

        try {
            const res = await fetch("/api/admin/support/reply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ticketId: ticket.id,
                    customerEmail: ticket.customer_email,
                    subject: `Re: ${ticket.subject}`,
                    bodyText: reply,
                }),
            });

            if (res.ok) {
                setReply("");
                await loadTicket();
            }
        } catch (err) {
            console.error("Failed to send reply:", err);
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
                    messages: messages.map((m) => ({
                        direction: m.direction,
                        body: m.body_text || "",
                        from: m.from_email,
                    })),
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
            }
        } catch (err) {
            console.error("AI draft failed:", err);
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
                setMessages((prev) =>
                    prev.map((m) => m.id === messageId ? { ...m, translation: data.translation } : m)
                );
            }
        } catch (err) {
            console.error("Translation failed:", err);
        }
        setTranslating(null);
    };

    if (loading || !ticket) {
        return (
            <>
                <div className={adminStyles.pageHeader}>
                    <h1 className={adminStyles.pageTitle}>Loading...</h1>
                </div>
            </>
        );
    }

    return (
        <>
            <Link href="/admin/support" className={styles.backLink}>
                ← Back to tickets
            </Link>

            {/* Header */}
            <div className={styles.detailHeader}>
                <div>
                    <h1 className={styles.detailSubject}>{ticket.subject}</h1>
                    <div className={styles.detailMeta}>
                        <span>{ticket.customer_name || ticket.customer_email}</span>
                        <span>•</span>
                        <select
                            className={styles.langSelect}
                            value={ticket.language}
                            onChange={(e) => updateLanguage(e.target.value)}
                        >
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
                    <select
                        className={styles.selectSmall}
                        value={ticket.status}
                        onChange={(e) => updateStatus(e.target.value)}
                    >
                        <option value="open">🟢 Open</option>
                        <option value="pending">🟡 Pending</option>
                        <option value="closed">⚫ Closed</option>
                    </select>
                    <select
                        className={styles.selectSmall}
                        value={ticket.priority}
                        onChange={(e) => updatePriority(e.target.value)}
                    >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">🔴 Urgent</option>
                    </select>
                </div>
            </div>

            {/* Order Context */}
            {order && (
                <div className={styles.orderCard}>
                    <div className={styles.orderCardTitle}>📦 Linked Order</div>
                    <div className={styles.orderCardGrid}>
                        <div className={styles.orderCardItem}>
                            <div className={styles.orderCardLabel}>Order ID</div>
                            <div className={styles.orderCardValue}>
                                <Link href={`/admin/orders/${order.id}`} style={{ color: "#2d5a3d", textDecoration: "underline" }}>
                                    {order.id.slice(0, 8)}...
                                </Link>
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

            {/* Message Thread */}
            <div className={styles.messageThread}>
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`${styles.message} ${msg.direction === "inbound" ? styles.messageInbound : styles.messageOutbound}`}
                    >
                        <div className={styles.messageHeader}>
                            <span>
                                <span className={styles.messageSender}>
                                    {msg.direction === "inbound" ? (ticket.customer_name || msg.from_email) : "You"}
                                </span>
                                {msg.is_ai_generated && <span className={styles.aiBadge}>AI</span>}
                            </span>
                            <span>{timeAgo(msg.created_at)}</span>
                        </div>
                        <div className={styles.messageBody}>
                            {msg.fetchingBody ? (
                                <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
                                    ⏳ Fetching email content from Resend...
                                </span>
                            ) : msg.body_text ? (
                                msg.body_text
                            ) : msg.resend_email_id ? (
                                <span style={{ color: "#94a3b8" }}>
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

                        {/* Translate button for all inbound messages */}
                        {msg.direction === "inbound" && !msg.translation && (
                            <button
                                className={styles.translateBtn}
                                onClick={() => translateMessage(msg.id, msg.body_text || "")}
                                disabled={translating === msg.id}
                                style={{ marginTop: 8 }}
                            >
                                {translating === msg.id ? "Translating..." : "🌐 Translate to Dutch"}
                            </button>
                        )}

                        {/* Translation result */}
                        {msg.translation && (
                            <div className={styles.translationBox}>
                                <div className={styles.translationLabel}>🇳🇱 Dutch Translation</div>
                                {msg.translation}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Reply Box */}
            {ticket.status !== "closed" && (
                <div className={styles.replyBox}>
                    <textarea
                        className={styles.replyTextarea}
                        placeholder={`Reply to ${ticket.customer_name || ticket.customer_email}...`}
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                    />
                    {/* AI Context Input */}
                    <div className={styles.aiContextSection}>
                        <button
                            className={styles.aiContextToggle}
                            onClick={() => setShowAiContext(!showAiContext)}
                            type="button"
                        >
                            {showAiContext ? "▾" : "▸"} AI Context / Instructions
                        </button>
                        {showAiContext && (
                            <textarea
                                className={styles.aiContextTextarea}
                                placeholder="Give the AI extra context, e.g. 'Offer coupon OSTERN26', 'Explain we ship from NL in 3-5 days', 'Apologize for delay'..."
                                value={aiContext}
                                onChange={(e) => setAiContext(e.target.value)}
                                rows={3}
                            />
                        )}
                    </div>

                    <div className={styles.replyActions}>
                        <div className={styles.replyBtnGroup}>
                            <button
                                className={styles.aiBtn}
                                onClick={generateAiDraft}
                                disabled={aiLoading}
                            >
                                {aiLoading ? "✨ Generating..." : "✨ AI Draft"}
                            </button>
                        </div>
                        <button
                            className={styles.sendBtn}
                            onClick={sendReply}
                            disabled={!reply.trim() || sending}
                        >
                            {sending ? "Sending..." : "Send Reply"}
                        </button>
                    </div>
                </div>
            )}

            {/* Closed ticket notice */}
            {ticket.status === "closed" && (
                <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontSize: "0.9rem" }}>
                    This ticket is closed.{" "}
                    <button
                        onClick={() => updateStatus("open")}
                        style={{ color: "#2d5a3d", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
                    >
                        Reopen
                    </button>
                </div>
            )}
        </>
    );
}
