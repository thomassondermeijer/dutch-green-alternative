"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../admin.module.css";

type InvoiceOrder = {
    id: string;
    order_number: string;
    customer_email: string;
    status: string;
    payment_status: string;
    total: number;
    invoice_surcharge: number;
    payment_due_date: string | null;
    invoice_sent_at: string | null;
    reminder_count: number;
    paid_at: string | null;
    created_at: string;
    shipping_address: { first_name: string; last_name: string } | null;
};

type FilterTab = "all" | "unpaid" | "overdue" | "paid";

const PAYMENT_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    unpaid: { bg: "#fff7ed", color: "#c2410c" },
    overdue: { bg: "#fef2f2", color: "#991b1b" },
    paid: { bg: "#f0fdf4", color: "#166534" },
    refunded: { bg: "#f3e8ff", color: "#6b21a8" },
};

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<InvoiceOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterTab>("all");
    const [search, setSearch] = useState("");
    const router = useRouter();

    useEffect(() => {
        const supabase = createClient();
        supabase
            .from("orders")
            .select("id, order_number, customer_email, status, payment_status, total, invoice_surcharge, payment_due_date, invoice_sent_at, reminder_count, paid_at, created_at, shipping_address")
            .eq("payment_method", "invoice")
            .order("created_at", { ascending: false })
            .then(({ data }) => {
                setInvoices((data || []) as InvoiceOrder[]);
                setLoading(false);
            });
    }, []);

    // Filter & search
    const filtered = invoices.filter((inv) => {
        if (filter !== "all" && inv.payment_status !== filter) return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                inv.order_number.toLowerCase().includes(q) ||
                inv.customer_email.toLowerCase().includes(q)
            );
        }
        return true;
    });

    // Stats
    const totalInvoices = invoices.length;
    const unpaidAmount = invoices
        .filter((i) => i.payment_status === "unpaid" || i.payment_status === "overdue")
        .reduce((sum, i) => sum + Number(i.total), 0);
    const overdueCount = invoices.filter((i) => i.payment_status === "overdue").length;
    const paidThisMonth = invoices.filter((i) => {
        if (i.payment_status !== "paid" || !i.paid_at) return false;
        const paidDate = new Date(i.paid_at);
        const now = new Date();
        return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear();
    }).length;

    const isOverdue = (inv: InvoiceOrder) => {
        if (!inv.payment_due_date || inv.payment_status === "paid") return false;
        return new Date(inv.payment_due_date) < new Date();
    };

    return (
        <>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Invoices</h1>
            </div>

            {/* Stats Bar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
                <div className={styles.formCard} style={{ maxWidth: "100%", textAlign: "center", padding: "1.25rem" }}>
                    <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1a1a1a" }}>{totalInvoices}</div>
                    <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Total Invoices</div>
                </div>
                <div className={styles.formCard} style={{ maxWidth: "100%", textAlign: "center", padding: "1.25rem" }}>
                    <div style={{ fontSize: "2rem", fontWeight: 700, color: "#c2410c" }}>€{unpaidAmount.toFixed(2)}</div>
                    <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Outstanding</div>
                </div>
                <div className={styles.formCard} style={{ maxWidth: "100%", textAlign: "center", padding: "1.25rem" }}>
                    <div style={{ fontSize: "2rem", fontWeight: 700, color: "#991b1b" }}>{overdueCount}</div>
                    <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Overdue</div>
                </div>
                <div className={styles.formCard} style={{ maxWidth: "100%", textAlign: "center", padding: "1.25rem" }}>
                    <div style={{ fontSize: "2rem", fontWeight: 700, color: "#166534" }}>{paidThisMonth}</div>
                    <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Paid This Month</div>
                </div>
            </div>

            {/* Search + Filter */}
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", alignItems: "center" }}>
                <input
                    className={styles.formInput}
                    type="text"
                    placeholder="Search by order # or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ maxWidth: "320px" }}
                />
                <div style={{ display: "flex", gap: "0.25rem", background: "#f3f4f6", borderRadius: "8px", padding: "3px" }}>
                    {(["all", "unpaid", "overdue", "paid"] as FilterTab[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            style={{
                                padding: "6px 14px",
                                borderRadius: "6px",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                                fontWeight: 600,
                                background: filter === tab ? "#ffffff" : "transparent",
                                color: filter === tab ? "#1a1a1a" : "#6b7280",
                                boxShadow: filter === tab ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                                transition: "all 0.15s",
                            }}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            {tab === "overdue" && overdueCount > 0 && (
                                <span style={{ marginLeft: "4px", background: "#fef2f2", color: "#991b1b", padding: "1px 6px", borderRadius: "10px", fontSize: "0.7rem" }}>
                                    {overdueCount}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <p style={{ color: "#6b7280" }}>Loading...</p>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
                    <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📄</p>
                    <p>No invoices found</p>
                </div>
            ) : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Invoice #</th>
                            <th>Customer</th>
                            <th>Amount</th>
                            <th>Due Date</th>
                            <th>Payment</th>
                            <th>Fulfillment</th>
                            <th>Reminders</th>
                            <th>Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((inv) => {
                            const payColors = PAYMENT_STATUS_COLORS[inv.payment_status] || PAYMENT_STATUS_COLORS.unpaid;
                            const overdue = isOverdue(inv);
                            return (
                                <tr
                                    key={inv.id}
                                    onClick={() => router.push(`/admin/orders/${inv.id}`)}
                                    style={{ cursor: "pointer" }}
                                >
                                    <td style={{ fontWeight: 600 }}>{inv.order_number}</td>
                                    <td>
                                        <div>{inv.customer_email}</div>
                                        {inv.shipping_address && (
                                            <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                                                {inv.shipping_address.first_name} {inv.shipping_address.last_name}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ fontWeight: 600 }}>€{Number(inv.total).toFixed(2)}</td>
                                    <td>
                                        {inv.payment_due_date ? (
                                            <span style={{ color: overdue && inv.payment_status !== "paid" ? "#dc2626" : "#374151", fontWeight: overdue ? 600 : 400 }}>
                                                {new Date(inv.payment_due_date).toLocaleDateString()}
                                                {overdue && inv.payment_status !== "paid" && " ⚠️"}
                                            </span>
                                        ) : "—"}
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: "2px 10px",
                                            borderRadius: "12px",
                                            fontSize: "0.75rem",
                                            fontWeight: 600,
                                            background: payColors.bg,
                                            color: payColors.color,
                                            textTransform: "uppercase",
                                        }}>
                                            {inv.payment_status}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: "2px 10px",
                                            borderRadius: "12px",
                                            fontSize: "0.75rem",
                                            fontWeight: 600,
                                            background: "#f3f4f6",
                                            color: "#374151",
                                            textTransform: "uppercase",
                                        }}>
                                            {inv.status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: "center" }}>
                                        {inv.reminder_count > 0 ? (
                                            <span style={{
                                                padding: "2px 8px",
                                                borderRadius: "12px",
                                                fontSize: "0.75rem",
                                                fontWeight: 600,
                                                background: inv.reminder_count >= 3 ? "#fef2f2" : inv.reminder_count >= 2 ? "#fff7ed" : "#fefce8",
                                                color: inv.reminder_count >= 3 ? "#991b1b" : inv.reminder_count >= 2 ? "#c2410c" : "#854d0e",
                                            }}>
                                                {inv.reminder_count}/3
                                            </span>
                                        ) : (
                                            <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                                        {new Date(inv.created_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </>
    );
}
