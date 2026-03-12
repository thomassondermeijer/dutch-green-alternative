"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildOrderConfirmationEmail } from "@/lib/resend/templates/order-confirmation";
import { buildShippingNotificationEmail } from "@/lib/resend/templates/shipping-notification";
import { buildWelcomeEmail } from "@/lib/resend/templates/welcome";
import { buildInvoiceEmail } from "@/lib/resend/templates/invoice";
import { buildPaymentReminderEmail } from "@/lib/resend/templates/payment-reminder";
import { buildPostDeliveryTipsEmail } from "@/lib/resend/templates/post-delivery-tips";
import { buildReviewRequestEmail } from "@/lib/resend/templates/review-request";
import styles from "../admin.module.css";

type Tab = "preview" | "sequences" | "activity";
type TemplateKey = "order-confirmation" | "shipping-notification" | "welcome" | "invoice" | "reminder-1" | "reminder-2" | "reminder-3" | "post-delivery-tips" | "review-request";

type Sequence = {
    id: string; name: string; slug: string; description: string;
    trigger_event: string; is_active: boolean;
    email_sequence_steps: Step[];
};
type Step = {
    id: string; step_order: number; delay_hours: number;
    template_slug: string; subject_de: string; subject_nl: string; subject_en: string;
    is_active: boolean;
};
type EmailSend = {
    id: string; recipient: string; template: string; subject: string;
    language: string; status: string; sent_at: string;
    metadata: { order_number?: string };
};

const TEMPLATES: { id: TemplateKey; label: string; category: string }[] = [
    { id: "order-confirmation", label: "Order Confirmation", category: "Transactional" },
    { id: "shipping-notification", label: "Shipping Notification", category: "Transactional" },
    { id: "welcome", label: "Welcome", category: "Transactional" },
    { id: "invoice", label: "Invoice", category: "Transactional" },
    { id: "reminder-1", label: "Payment Reminder (Friendly)", category: "Payment" },
    { id: "reminder-2", label: "Payment Reminder (Final Notice)", category: "Payment" },
    { id: "reminder-3", label: "Payment Reminder (Debt Collection)", category: "Payment" },
    { id: "post-delivery-tips", label: "Post-Delivery Tips", category: "Automated" },
    { id: "review-request", label: "Review Request", category: "Automated" },
];

const SAMPLE_ORDER = {
    orderNumber: "DGA-20260312-001",
    customerName: "Thomas",
    items: [
        { name: "RAW CBD Oil 11%", quantity: 2, price: 41.95 },
        { name: "Golden Spectrum 35% (CBD+CBG+CBN)", quantity: 1, price: 89.95 },
    ],
    subtotal: 173.85, shipping: 0, discount: 10.0, invoiceSurcharge: 1.99,
    total: 165.84, shippingAddress: "Thomas Sondermeijer\nRijswijkstraat 123\n1059 Amsterdam\nNL",
    paymentDueDate: "25. März 2026", locale: "de",
};

function buildTemplateHtml(templateId: TemplateKey, locale: string): string {
    const dueDate = new Date(Date.now() + 14 * 86400000);
    const localeDueDate = dueDate.toLocaleDateString(
        locale === "de" ? "de-DE" : locale === "nl" ? "nl-NL" : "en-GB",
        { day: "2-digit", month: "long", year: "numeric" }
    );
    const data = { ...SAMPLE_ORDER, locale, paymentDueDate: localeDueDate };

    switch (templateId) {
        case "order-confirmation": return buildOrderConfirmationEmail(data);
        case "shipping-notification": return buildShippingNotificationEmail({ customerName: data.customerName, orderNumber: data.orderNumber, trackingNumber: "DHL-1234567890", trackingUrl: "https://dhl.de/track/1234567890", locale });
        case "welcome": return buildWelcomeEmail({ customerName: data.customerName, locale });
        case "invoice": return buildInvoiceEmail(data);
        case "reminder-1": return buildPaymentReminderEmail({ ...data, reminderStage: 1, daysPastDue: 10 });
        case "reminder-2": return buildPaymentReminderEmail({ ...data, reminderStage: 2, daysPastDue: 17 });
        case "reminder-3": return buildPaymentReminderEmail({ ...data, reminderStage: 3, daysPastDue: 24 });
        case "post-delivery-tips": return buildPostDeliveryTipsEmail({ customerName: data.customerName, productNames: data.items.map(i => i.name), locale });
        case "review-request": return buildReviewRequestEmail({ customerName: data.customerName, orderNumber: data.orderNumber, productNames: data.items.map(i => i.name), locale, reviewToken: "rv_sample_preview" });
    }
}

export default function EmailHubPage() {
    const [tab, setTab] = useState<Tab>("preview");
    const [templateId, setTemplateId] = useState<TemplateKey>("order-confirmation");
    const [locale, setLocale] = useState("de");
    const [htmlOverride, setHtmlOverride] = useState<string | null>(null);
    const [showSource, setShowSource] = useState(false);

    // Sequences
    const [sequences, setSequences] = useState<Sequence[]>([]);
    const [seqLoading, setSeqLoading] = useState(false);

    // Activity
    const [sends, setSends] = useState<EmailSend[]>([]);
    const [actLoading, setActLoading] = useState(false);
    const [actFilter, setActFilter] = useState("");

    const baseHtml = buildTemplateHtml(templateId, locale);
    const displayHtml = htmlOverride ?? baseHtml;

    // Reset override when template/locale changes
    useEffect(() => { setHtmlOverride(null); }, [templateId, locale]);

    const loadSequences = useCallback(async () => {
        setSeqLoading(true);
        const supabase = createClient();
        const { data } = await supabase.from("email_sequences").select("*, email_sequence_steps(*)").order("created_at");
        setSequences((data || []) as Sequence[]);
        setSeqLoading(false);
    }, []);

    const loadActivity = useCallback(async () => {
        setActLoading(true);
        const supabase = createClient();
        let query = supabase.from("email_log").select("*").order("sent_at", { ascending: false }).limit(100);
        if (actFilter) query = query.eq("template", actFilter);
        const { data } = await query;
        setSends((data || []) as EmailSend[]);
        setActLoading(false);
    }, [actFilter]);

    useEffect(() => { if (tab === "sequences") loadSequences(); }, [tab, loadSequences]);
    useEffect(() => { if (tab === "activity") loadActivity(); }, [tab, actFilter, loadActivity]);

    const toggleSequence = async (seq: Sequence) => {
        const supabase = createClient();
        await supabase.from("email_sequences").update({ is_active: !seq.is_active }).eq("id", seq.id);
        loadSequences();
    };

    const categories = Array.from(new Set(TEMPLATES.map(t => t.category)));

    return (
        <>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Email Hub</h1>
                <div style={{ display: "flex", gap: "4px", background: "#f1f5f9", borderRadius: "8px", padding: "3px" }}>
                    {(["preview", "sequences", "activity"] as Tab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            style={{
                                padding: "8px 16px", border: "none", borderRadius: "6px", cursor: "pointer",
                                fontSize: "0.85rem", fontWeight: 600, fontFamily: "inherit",
                                background: tab === t ? "white" : "transparent",
                                color: tab === t ? "#1e293b" : "#64748b",
                                boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                            }}
                        >
                            {t === "preview" ? "📧 Templates" : t === "sequences" ? "⚡ Sequences" : "📊 Activity"}
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══ TAB 1: Template Preview ═══ */}
            {tab === "preview" && (
                <>
                    {/* Template & language selectors */}
                    <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "flex-start" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {categories.map(cat => (
                                <div key={cat} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", minWidth: 90 }}>{cat}</span>
                                    {TEMPLATES.filter(t => t.category === cat).map(t => (
                                        <button
                                            key={t.id} onClick={() => setTemplateId(t.id)}
                                            style={{
                                                padding: "6px 12px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                                                border: templateId === t.id ? "2px solid #2d5a3d" : "1px solid #e2e8f0",
                                                background: templateId === t.id ? "#f0fdf4" : "white",
                                                color: templateId === t.id ? "#2d5a3d" : "#64748b",
                                            }}
                                        >{t.label}</button>
                                    ))}
                                </div>
                            ))}
                        </div>

                        <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
                            <div style={{ display: "flex", gap: "2px", background: "#f1f5f9", borderRadius: "6px", padding: "2px" }}>
                                {["de", "nl", "en"].map(l => (
                                    <button key={l} onClick={() => setLocale(l)} style={{
                                        padding: "5px 10px", borderRadius: "4px", border: "none", cursor: "pointer",
                                        fontSize: "0.8rem", fontWeight: 600, fontFamily: "inherit",
                                        background: locale === l ? "white" : "transparent",
                                        color: locale === l ? "#1e293b" : "#94a3b8",
                                    }}>{l.toUpperCase()}</button>
                                ))}
                            </div>
                            <button onClick={() => setShowSource(!showSource)} style={{
                                padding: "6px 12px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                                border: "1px solid #e2e8f0", fontFamily: "inherit",
                                background: showSource ? "#1e293b" : "white", color: showSource ? "white" : "#64748b",
                            }}>{showSource ? "👁 Preview" : "</> Source"}</button>
                        </div>
                    </div>

                    {/* Preview or Source Editor */}
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
                        {/* Browser chrome */}
                        <div style={{ background: "#f8fafc", padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: "6px", alignItems: "center" }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
                            <span style={{ marginLeft: "1rem", color: "#94a3b8", fontSize: "0.75rem" }}>
                                {showSource ? "HTML Source Editor" : "Email Preview"} — {TEMPLATES.find(t => t.id === templateId)?.label} ({locale.toUpperCase()})
                            </span>
                        </div>

                        {showSource ? (
                            <textarea
                                value={displayHtml}
                                onChange={(e) => setHtmlOverride(e.target.value)}
                                style={{
                                    width: "100%", height: "700px", border: "none", padding: "16px",
                                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: "12px",
                                    lineHeight: 1.5, resize: "none", background: "#1e293b", color: "#e2e8f0",
                                    outline: "none",
                                }}
                                spellCheck={false}
                            />
                        ) : (
                            <iframe
                                srcDoc={displayHtml}
                                style={{ width: "100%", height: "700px", border: "none", background: "#f3f4f6" }}
                                title="Email Preview"
                            />
                        )}
                    </div>

                    {htmlOverride && (
                        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                            <button onClick={() => setHtmlOverride(null)} style={{
                                padding: "8px 16px", borderRadius: "6px", border: "1px solid #e2e8f0",
                                background: "white", cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit",
                            }}>Reset to Original</button>
                            <span style={{ color: "#f59e0b", fontSize: "0.8rem", alignSelf: "center" }}>
                                ⚠️ Editing HTML preview only — template code unchanged
                            </span>
                        </div>
                    )}
                </>
            )}

            {/* ═══ TAB 2: Sequences ═══ */}
            {tab === "sequences" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {seqLoading ? (
                        <p style={{ color: "#94a3b8" }}>Loading sequences...</p>
                    ) : sequences.length === 0 ? (
                        <p style={{ color: "#94a3b8" }}>No sequences configured</p>
                    ) : sequences.map(seq => (
                        <div key={seq.id} style={{ background: "white", borderRadius: "12px", padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>{seq.name}</h3>
                                    <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748b" }}>{seq.description}</p>
                                </div>
                                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                                    <span style={{
                                        padding: "4px 12px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 600,
                                        background: seq.is_active ? "#dcfce7" : "#f1f5f9",
                                        color: seq.is_active ? "#166534" : "#64748b",
                                    }}>
                                        {seq.is_active ? "Active" : "Paused"}
                                    </span>
                                    <button onClick={() => toggleSequence(seq)} style={{
                                        padding: "6px 14px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 600,
                                        border: "1px solid #e2e8f0", cursor: "pointer", fontFamily: "inherit",
                                        background: seq.is_active ? "#fef2f2" : "#f0fdf4",
                                        color: seq.is_active ? "#dc2626" : "#16a34a",
                                    }}>
                                        {seq.is_active ? "Pause" : "Activate"}
                                    </button>
                                </div>
                            </div>

                            {/* Trigger info */}
                            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", fontSize: "0.8rem" }}>
                                <span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "3px 10px", borderRadius: "4px", fontWeight: 600 }}>
                                    Trigger: {seq.trigger_event}
                                </span>
                            </div>

                            {/* Steps timeline */}
                            <div style={{ position: "relative", paddingLeft: "24px" }}>
                                <div style={{ position: "absolute", left: "8px", top: "4px", bottom: "4px", width: "2px", background: "#e2e8f0" }} />
                                {(seq.email_sequence_steps || []).sort((a, b) => a.step_order - b.step_order).map((step, i) => (
                                    <div key={step.id} style={{ position: "relative", paddingBottom: "16px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
                                        <div style={{
                                            position: "absolute", left: "-20px", top: "2px",
                                            width: "14px", height: "14px", borderRadius: "50%",
                                            background: step.is_active ? "#2d5a3d" : "#cbd5e1",
                                            border: "3px solid white", boxShadow: "0 0 0 2px #e2e8f0",
                                        }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "2px" }}>
                                                <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e293b" }}>
                                                    Step {step.step_order}
                                                </span>
                                                <span style={{ fontSize: "0.75rem", color: "#94a3b8", background: "#f8fafc", padding: "2px 8px", borderRadius: "4px" }}>
                                                    ⏱ {step.delay_hours}h delay ({Math.round(step.delay_hours / 24)}d)
                                                </span>
                                            </div>
                                            <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#475569" }}>
                                                Template: <code style={{ background: "#f1f5f9", padding: "1px 6px", borderRadius: "4px", fontSize: "0.8rem" }}>{step.template_slug}</code>
                                            </p>
                                            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                                                DE: {step.subject_de}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setTab("preview");
                                                setTemplateId(step.template_slug as TemplateKey);
                                            }}
                                            style={{
                                                padding: "4px 10px", borderRadius: "4px", fontSize: "0.75rem",
                                                border: "1px solid #e2e8f0", background: "white", cursor: "pointer",
                                                color: "#64748b", fontFamily: "inherit",
                                            }}
                                        >Preview</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ═══ TAB 3: Activity Log ═══ */}
            {tab === "activity" && (
                <>
                    {/* Stats row */}
                    <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                        {["All", ...TEMPLATES.map(t => t.id)].slice(0, 6).map(f => (
                            <button
                                key={f}
                                onClick={() => setActFilter(f === "All" ? "" : f)}
                                style={{
                                    padding: "5px 12px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600,
                                    border: (actFilter === f || (f === "All" && !actFilter)) ? "2px solid #2d5a3d" : "1px solid #e2e8f0",
                                    background: (actFilter === f || (f === "All" && !actFilter)) ? "#f0fdf4" : "white",
                                    color: (actFilter === f || (f === "All" && !actFilter)) ? "#2d5a3d" : "#64748b",
                                    cursor: "pointer", fontFamily: "inherit",
                                }}
                            >{f === "All" ? "All" : TEMPLATES.find(t => t.id === f)?.label || f}</button>
                        ))}
                    </div>

                    {/* Stats summary */}
                    <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                        {[
                            { label: "Total Sent", value: sends.length, color: "#2d5a3d" },
                            { label: "Delivered", value: sends.filter(s => s.status === "sent" || s.status === "delivered").length, color: "#16a34a" },
                            { label: "Failed", value: sends.filter(s => s.status === "failed").length, color: "#dc2626" },
                        ].map(stat => (
                            <div key={stat.label} style={{ background: "white", borderRadius: "8px", padding: "12px 20px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", flex: 1, borderLeft: `3px solid ${stat.color}` }}>
                                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: stat.color }}>{stat.value}</div>
                                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{stat.label}</div>
                            </div>
                        ))}
                    </div>

                    {actLoading ? <p style={{ color: "#94a3b8" }}>Loading...</p> : sends.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
                            <p style={{ fontSize: "2rem" }}>📭</p>
                            <p>No emails sent yet</p>
                        </div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Recipient</th>
                                    <th>Template</th>
                                    <th>Subject</th>
                                    <th>Status</th>
                                    <th>Sent</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sends.map(send => (
                                    <tr key={send.id}>
                                        <td style={{ fontWeight: 600 }}>{send.recipient}</td>
                                        <td>
                                            <code style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: "4px", fontSize: "0.8rem" }}>
                                                {send.template}
                                            </code>
                                        </td>
                                        <td style={{ color: "#475569", fontSize: "0.85rem" }}>{send.subject}</td>
                                        <td>
                                            <span style={{
                                                padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600,
                                                background: send.status === "sent" || send.status === "delivered" ? "#dcfce7" : send.status === "failed" ? "#fef2f2" : "#fef3c7",
                                                color: send.status === "sent" || send.status === "delivered" ? "#166534" : send.status === "failed" ? "#991b1b" : "#92400e",
                                            }}>{send.status}</span>
                                        </td>
                                        <td style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                                            {new Date(send.sent_at).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </>
            )}
        </>
    );
}
