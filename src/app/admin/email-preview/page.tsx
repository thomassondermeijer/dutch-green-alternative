"use client";

import { useState } from "react";
import { buildInvoiceEmail } from "@/lib/resend/templates/invoice";
import { buildPaymentReminderEmail } from "@/lib/resend/templates/payment-reminder";
import styles from "../admin.module.css";

type Template = "invoice" | "reminder-1" | "reminder-2" | "reminder-3";

const SAMPLE_INVOICE = {
    orderNumber: "DGA-20260311-001",
    customerName: "Thomas",
    items: [
        { name: "RAW CBD Oil 11%", quantity: 2, price: 41.95 },
        { name: "Golden Spectrum 35% (CBD+CBG+CBN)", quantity: 1, price: 89.95 },
    ],
    subtotal: 173.85,
    shipping: 0,
    discount: 10.0,
    invoiceSurcharge: 1.99,
    total: 165.84,
    shippingAddress: "Thomas Sondermeijer\nRijswijkstraat 123\n1059 Amsterdam\nNL",
    paymentDueDate: "25. März 2026",
    locale: "de",
};

const SAMPLE_REMINDER = {
    orderNumber: "DGA-20260311-001",
    customerName: "Thomas Sondermeijer",
    total: 165.84,
    paymentDueDate: "25. März 2026",
    daysPastDue: 10,
    locale: "de",
};

export default function EmailPreviewPage() {
    const [selected, setSelected] = useState<Template>("invoice");
    const [locale, setLocale] = useState("de");

    let html = "";

    // Generate locale-aware due date
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const localeDueDate = dueDate.toLocaleDateString(
        locale === "de" ? "de-DE" : locale === "nl" ? "nl-NL" : "en-GB",
        { day: "2-digit", month: "long", year: "numeric" }
    );

    const invoiceData = { ...SAMPLE_INVOICE, locale, paymentDueDate: localeDueDate };
    const reminderBase = { ...SAMPLE_REMINDER, locale, paymentDueDate: localeDueDate };

    switch (selected) {
        case "invoice":
            html = buildInvoiceEmail(invoiceData);
            break;
        case "reminder-1":
            html = buildPaymentReminderEmail({ ...reminderBase, reminderStage: 1, daysPastDue: 10 });
            break;
        case "reminder-2":
            html = buildPaymentReminderEmail({ ...reminderBase, reminderStage: 2, daysPastDue: 17 });
            break;
        case "reminder-3":
            html = buildPaymentReminderEmail({ ...reminderBase, reminderStage: 3, daysPastDue: 24 });
            break;
    }

    const templates: { id: Template; label: string; emoji: string }[] = [
        { id: "invoice", label: "Invoice", emoji: "📄" },
        { id: "reminder-1", label: "Reminder 1 (Friendly)", emoji: "💚" },
        { id: "reminder-2", label: "Reminder 2 (Final Notice)", emoji: "🟠" },
        { id: "reminder-3", label: "Reminder 3 (Debt Collection)", emoji: "🔴" },
    ];

    return (
        <>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Email Template Preview</h1>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
                {/* Template selector */}
                {templates.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setSelected(t.id)}
                        style={{
                            padding: "8px 16px",
                            borderRadius: "8px",
                            border: selected === t.id ? "2px solid #2d5a3d" : "2px solid #e5e7eb",
                            background: selected === t.id ? "#f0fdf4" : "#ffffff",
                            color: selected === t.id ? "#2d5a3d" : "#6b7280",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            cursor: "pointer",
                            transition: "all 0.15s",
                        }}
                    >
                        {t.emoji} {t.label}
                    </button>
                ))}

                {/* Language selector */}
                <div style={{ marginLeft: "auto", display: "flex", gap: "0.25rem", background: "#f3f4f6", borderRadius: "8px", padding: "3px" }}>
                    {["de", "nl", "en"].map((l) => (
                        <button
                            key={l}
                            onClick={() => setLocale(l)}
                            style={{
                                padding: "6px 12px",
                                borderRadius: "6px",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                                fontWeight: 600,
                                background: locale === l ? "#ffffff" : "transparent",
                                color: locale === l ? "#1a1a1a" : "#6b7280",
                                boxShadow: locale === l ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                            }}
                        >
                            {l.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Email preview */}
            <div style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}>
                <div style={{
                    background: "#f9fafb",
                    padding: "12px 20px",
                    borderBottom: "1px solid #e5e7eb",
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ef4444" }} />
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#f59e0b" }} />
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#22c55e" }} />
                    <span style={{ marginLeft: "1rem", color: "#9ca3af", fontSize: "0.8rem" }}>Email Preview</span>
                </div>
                <iframe
                    srcDoc={html}
                    style={{
                        width: "100%",
                        height: "800px",
                        border: "none",
                        background: "#f3f4f6",
                    }}
                    title="Email Preview"
                />
            </div>
        </>
    );
}
