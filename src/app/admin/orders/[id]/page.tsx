"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../../admin.module.css";

type OrderItem = {
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    product_id: string;
};

type Communication = {
    id: string;
    type: string;
    subject: string;
    recipient: string;
    html: string;
    sent_at: string;
};

type Order = {
    id: string;
    order_number: string;
    customer_id: string | null;
    customer_email: string;
    status: string;
    subtotal: number;
    shipping_cost: number;
    discount_amount: number;
    total: number;
    shipping_address: {
        first_name: string;
        last_name: string;
        street: string;
        house_number: string;
        city: string;
        postal_code: string;
        country: string;
    };
    billing_address: {
        first_name: string;
        last_name: string;
        street: string;
        house_number: string;
        city: string;
        postal_code: string;
        country: string;
    } | null;
    language: string;
    coupon_code: string | null;
    curo_transaction_id: string | null;
    acut_order_id: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    payment_method: string | null;
    invoice_surcharge: number;
    payment_due_date: string | null;
    invoice_sent_at: string | null;
    reminder_count: number;
    last_reminder_at: string | null;
    paid_at: string | null;
    payment_status: string;
};

const STATUS_OPTIONS = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    pending: { bg: "#fef3c7", color: "#92400e" },
    paid: { bg: "#dbeafe", color: "#1e40af" },
    processing: { bg: "#e0e7ff", color: "#3730a3" },
    shipped: { bg: "#d1fae5", color: "#065f46" },
    delivered: { bg: "#bbf7d0", color: "#14532d" },
    cancelled: { bg: "#fee2e2", color: "#991b1b" },
    refunded: { bg: "#f3e8ff", color: "#6b21a8" },
};

const PAYMENT_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    unpaid: { bg: "#fff7ed", color: "#c2410c" },
    overdue: { bg: "#fef2f2", color: "#991b1b" },
    paid: { bg: "#f0fdf4", color: "#166534" },
    refunded: { bg: "#f3e8ff", color: "#6b21a8" },
};

export default function OrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = params.id as string;

    const [order, setOrder] = useState<Order | null>(null);
    const [items, setItems] = useState<OrderItem[]>([]);
    const [comms, setComms] = useState<Communication[]>([]);
    const [expandedComm, setExpandedComm] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sendingToAcut, setSendingToAcut] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Editable fields
    const [status, setStatus] = useState("");
    const [trackingNumber, setTrackingNumber] = useState("");
    const [trackingUrl, setTrackingUrl] = useState("");
    const [notes, setNotes] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("");
    const [newPaymentMethod, setNewPaymentMethod] = useState("");
    const [changingMethod, setChangingMethod] = useState(false);

    const loadOrder = useCallback(async () => {
        const supabase = createClient();

        const { data: orderData } = await supabase
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .single();

        if (orderData) {
            setOrder(orderData as Order);
            setStatus(orderData.status);
            setTrackingNumber(orderData.tracking_number || "");
            setTrackingUrl(orderData.tracking_url || "");
            setNotes(orderData.notes || "");
            setPaymentStatus(orderData.payment_status || "unpaid");
            setNewPaymentMethod(orderData.payment_method || "ideal");
        }

        const { data: itemsData } = await supabase
            .from("order_items")
            .select("*")
            .eq("order_id", orderId);

        setItems((itemsData || []) as OrderItem[]);

        const { data: commsData } = await supabase
            .from("order_communications")
            .select("*")
            .eq("order_id", orderId)
            .order("sent_at", { ascending: false });

        setComms((commsData || []) as Communication[]);
        setLoading(false);
    }, [orderId]);

    useEffect(() => {
        loadOrder();
    }, [loadOrder]);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        const supabase = createClient();
        const { error } = await supabase
            .from("orders")
            .update({
                status,
                payment_status: paymentStatus,
                tracking_number: trackingNumber || null,
                tracking_url: trackingUrl || null,
                notes: notes || null,
                updated_at: new Date().toISOString(),
            })
            .eq("id", orderId);

        if (error) {
            setMessage({ type: "error", text: `Failed to save: ${error.message}` });
        } else {
            setMessage({ type: "success", text: "Order updated successfully" });
            await loadOrder();
        }

        setSaving(false);
    };

    const handleSendToAcut = async () => {
        if (!order) return;
        setSendingToAcut(true);
        setMessage(null);

        try {
            const res = await fetch(`/api/admin/orders/${orderId}/send-to-acut`, {
                method: "POST",
            });

            const result = await res.json();

            if (res.ok && result.success) {
                setMessage({ type: "success", text: `Sent to Acut! Acut ID: ${result.acut_id}` });
                await loadOrder();
            } else {
                setMessage({ type: "error", text: result.error || "Failed to send to Acut" });
            }
        } catch {
            setMessage({ type: "error", text: "Network error" });
        }

        setSendingToAcut(false);
    };

    const handleMarkAsPaid = async () => {
        if (!order) return;
        setSaving(true);
        setMessage(null);

        const supabase = createClient();
        const { error } = await supabase
            .from("orders")
            .update({
                payment_status: "paid",
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", orderId);

        if (error) {
            setMessage({ type: "error", text: `Failed: ${error.message}` });
        } else {
            setMessage({ type: "success", text: "Order marked as paid!" });
            await loadOrder();
        }
        setSaving(false);
    };

    const handleChangePaymentMethod = async () => {
        if (!order) return;
        if (newPaymentMethod === order.payment_method) {
            setMessage({ type: "error", text: "Select a different payment method." });
            return;
        }
        if (newPaymentMethod === "invoice") {
            if (!confirm("Switch to invoice? This resends the invoice email with the updated total and a new 14-day due date.")) {
                return;
            }
        }
        setChangingMethod(true);
        setMessage(null);

        try {
            const res = await fetch(`/api/admin/orders/${orderId}/change-payment-method`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentMethod: newPaymentMethod }),
            });
            const result = await res.json();

            if (res.ok && result.success) {
                setMessage({
                    type: "success",
                    text: result.warning ? `Method updated — ${result.warning}` : "Payment method updated.",
                });
                await loadOrder();
            } else {
                setMessage({ type: "error", text: result.error || "Failed to change payment method" });
            }
        } catch {
            setMessage({ type: "error", text: "Network error" });
        }

        setChangingMethod(false);
    };

    const handleDelete = async () => {
        if (!order) return;
        setDeleting(true);
        setMessage(null);

        const supabase = createClient();

        // Delete order items first
        await supabase.from("order_items").delete().eq("order_id", orderId);

        // Then delete the order
        const { error } = await supabase.from("orders").delete().eq("id", orderId);

        if (error) {
            setMessage({ type: "error", text: `Failed to delete: ${error.message}` });
            setDeleting(false);
            setShowDeleteConfirm(false);
        } else {
            router.push("/admin/orders");
        }
    };

    if (loading) {
        return <p style={{ color: "#6b7280" }}>Loading order...</p>;
    }

    if (!order) {
        return (
            <div className={styles.emptyState}>
                <p>Order not found</p>
                <button className={styles.actionBtn} onClick={() => router.push("/admin/orders")} style={{ marginTop: "1rem" }}>
                    ← Back to Orders
                </button>
            </div>
        );
    }

    const statusStyle = STATUS_COLORS[order.status] || STATUS_COLORS.pending;

    return (
        <>
            <div className={styles.pageHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <button className={styles.actionBtn} onClick={() => router.push("/admin/orders")}>
                        ← Back
                    </button>
                    <h1 className={styles.pageTitle}>{order.order_number}</h1>
                    <span
                        style={{
                            padding: "4px 12px",
                            borderRadius: "12px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            textTransform: "uppercase",
                        }}
                    >
                        {order.status}
                    </span>
                    {order.payment_method === "invoice" && (
                        <span
                            style={{
                                padding: "4px 12px",
                                borderRadius: "12px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                background: (PAYMENT_STATUS_COLORS[order.payment_status || "unpaid"] || PAYMENT_STATUS_COLORS.unpaid).bg,
                                color: (PAYMENT_STATUS_COLORS[order.payment_status || "unpaid"] || PAYMENT_STATUS_COLORS.unpaid).color,
                                textTransform: "uppercase",
                            }}
                        >
                            💰 {order.payment_status || "unpaid"}
                        </span>
                    )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    {!order.acut_order_id && (
                        <button
                            className={styles.actionBtn}
                            onClick={handleSendToAcut}
                            disabled={sendingToAcut}
                            style={{ background: "#eef2ff", color: "#3730a3", borderColor: "#c7d2fe" }}
                        >
                            {sendingToAcut ? "Sending..." : "📦 Send to Acut"}
                        </button>
                    )}
                    {order.payment_method === "invoice" && (order.payment_status === "unpaid" || order.payment_status === "overdue") && (
                        <button
                            className={styles.actionBtn}
                            onClick={handleMarkAsPaid}
                            disabled={saving}
                            style={{ background: "#dbeafe", color: "#1e40af", borderColor: "#93c5fd" }}
                        >
                            {saving ? "..." : "✓ Mark as Paid"}
                        </button>
                    )}
                    <button
                        className={styles.actionBtn}
                        onClick={handleSave}
                        disabled={saving}
                        style={{ background: "#f0fdf4", color: "#065f46", borderColor: "#bbf7d0" }}
                    >
                        {saving ? "Saving..." : "💾 Save Changes"}
                    </button>
                    <button
                        className={styles.actionBtn}
                        onClick={() => setShowDeleteConfirm(true)}
                        style={{ background: "#fef2f2", color: "#991b1b", borderColor: "#fecaca" }}
                    >
                        🗑️ Delete
                    </button>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
                }}>
                    <div style={{
                        background: "#fff", borderRadius: "12px", padding: "2rem", maxWidth: "420px", width: "90%",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                    }}>
                        <h3 style={{ margin: "0 0 0.5rem", color: "#991b1b" }}>🗑️ Delete Order?</h3>
                        <p style={{ color: "#6b7280", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
                            Are you sure you want to delete <strong>{order.order_number}</strong>? This will permanently remove the order and all its items. This action cannot be undone.
                        </p>
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                            <button
                                className={styles.actionBtn}
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.actionBtn}
                                onClick={handleDelete}
                                disabled={deleting}
                                style={{ background: "#991b1b", color: "#fff", borderColor: "#991b1b" }}
                            >
                                {deleting ? "Deleting..." : "Yes, Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {message && (
                <div className={message.type === "success" ? styles.success : styles.error}>
                    {message.text}
                </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                {/* Order Info Card */}
                <div className={styles.formCard} style={{ maxWidth: "100%" }}>
                    <h3 className={styles.formSectionTitle} style={{ marginTop: 0 }}>Order Info</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.875rem" }}>
                        <div><span style={{ color: "#6b7280" }}>Date:</span><br />{new Date(order.created_at).toLocaleString()}</div>
                        <div><span style={{ color: "#6b7280" }}>Email:</span><br />{order.customer_email}</div>
                        <div><span style={{ color: "#6b7280" }}>Language:</span><br />{order.language?.toUpperCase()}</div>
                        <div><span style={{ color: "#6b7280" }}>Coupon:</span><br />{order.coupon_code || "—"}</div>
                        <div><span style={{ color: "#6b7280" }}>CardGate TX:</span><br /><span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{order.curo_transaction_id || "—"}</span></div>
                        <div><span style={{ color: "#6b7280" }}>Acut ID:</span><br /><span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{order.acut_order_id || "—"}</span></div>
                        <div><span style={{ color: "#6b7280" }}>Payment Method:</span><br />{order.payment_method || "—"}</div>
                        {order.payment_method === "invoice" && (
                            <>
                                <div><span style={{ color: "#6b7280" }}>Due Date:</span><br />{order.payment_due_date ? new Date(order.payment_due_date).toLocaleDateString() : "—"}</div>
                                <div><span style={{ color: "#6b7280" }}>Invoice Sent:</span><br />{order.invoice_sent_at ? new Date(order.invoice_sent_at).toLocaleString() : "—"}</div>
                                <div><span style={{ color: "#6b7280" }}>Reminders Sent:</span><br />{order.reminder_count || 0}</div>
                                <div><span style={{ color: "#6b7280" }}>Last Reminder:</span><br />{order.last_reminder_at ? new Date(order.last_reminder_at).toLocaleString() : "—"}</div>
                                <div><span style={{ color: "#6b7280" }}>Paid At:</span><br />{order.paid_at ? new Date(order.paid_at).toLocaleString() : "Not yet paid"}</div>
                            </>
                        )}
                    </div>
                </div>

                {/* Addresses Card */}
                <div className={styles.formCard} style={{ maxWidth: "100%" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                        <div>
                            <h3 className={styles.formSectionTitle} style={{ marginTop: 0 }}>Shipping Address</h3>
                            {order.shipping_address && (
                                <div style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>
                                    <strong>{order.shipping_address.first_name} {order.shipping_address.last_name}</strong><br />
                                    {order.shipping_address.street} {order.shipping_address.house_number}<br />
                                    {order.shipping_address.postal_code} {order.shipping_address.city}<br />
                                    {order.shipping_address.country}
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className={styles.formSectionTitle} style={{ marginTop: 0 }}>Billing Address</h3>
                            {order.billing_address ? (
                                <div style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>
                                    <strong>{order.billing_address.first_name} {order.billing_address.last_name}</strong><br />
                                    {order.billing_address.street} {order.billing_address.house_number}<br />
                                    {order.billing_address.postal_code} {order.billing_address.city}<br />
                                    {order.billing_address.country}
                                </div>
                            ) : (
                                <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>Same as shipping</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Line Items */}
            <div className={styles.formCard} style={{ maxWidth: "100%", marginBottom: "1.5rem" }}>
                <h3 className={styles.formSectionTitle} style={{ marginTop: 0 }}>Order Items</h3>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th style={{ textAlign: "center" }}>Qty</th>
                            <th style={{ textAlign: "right" }}>Unit Price</th>
                            <th style={{ textAlign: "right" }}>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id}>
                                <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                                <td style={{ textAlign: "center" }}>{item.quantity}</td>
                                <td style={{ textAlign: "right" }}>€{Number(item.unit_price).toFixed(2)}</td>
                                <td style={{ textAlign: "right" }}>€{Number(item.total_price).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={3} style={{ textAlign: "right", color: "#6b7280" }}>Subtotal</td>
                            <td style={{ textAlign: "right" }}>€{Number(order.subtotal).toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td colSpan={3} style={{ textAlign: "right", color: "#6b7280" }}>Shipping</td>
                            <td style={{ textAlign: "right" }}>{Number(order.shipping_cost) === 0 ? "Free" : `€${Number(order.shipping_cost).toFixed(2)}`}</td>
                        </tr>
                        {Number(order.discount_amount) > 0 && (
                            <tr>
                                <td colSpan={3} style={{ textAlign: "right", color: "#059669" }}>Discount</td>
                                <td style={{ textAlign: "right", color: "#059669" }}>−€{Number(order.discount_amount).toFixed(2)}</td>
                            </tr>
                        )}
                        {Number(order.invoice_surcharge) > 0 && (
                            <tr>
                                <td colSpan={3} style={{ textAlign: "right", color: "#6b7280" }}>Invoice Fee</td>
                                <td style={{ textAlign: "right" }}>€{Number(order.invoice_surcharge).toFixed(2)}</td>
                            </tr>
                        )}
                        <tr>
                            <td colSpan={3} style={{ textAlign: "right", fontWeight: 700, fontSize: "1rem" }}>Total</td>
                            <td style={{ textAlign: "right", fontWeight: 700, fontSize: "1rem" }}>€{Number(order.total).toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Management Section */}
            <div className={styles.formCard} style={{ maxWidth: "100%" }}>
                <h3 className={styles.formSectionTitle} style={{ marginTop: 0 }}>Manage Order</h3>
                <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Fulfillment Status</label>
                        <select className={styles.formSelect} value={status} onChange={(e) => setStatus(e.target.value)}>
                            {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Payment Status</label>
                        <select className={styles.formSelect} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                            {["unpaid", "paid", "overdue", "refunded"].map((s) => (
                                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Payment Method</label>
                        {(order.payment_status === "unpaid" || order.payment_status === "overdue") ? (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <select
                                    className={styles.formSelect}
                                    value={newPaymentMethod}
                                    onChange={(e) => setNewPaymentMethod(e.target.value)}
                                    style={{ flex: 1 }}
                                >
                                    {["ideal", "creditcard", "bancontact", "sofortbanking", "invoice"].map((m) => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                                <button
                                    className={styles.actionBtn}
                                    onClick={handleChangePaymentMethod}
                                    disabled={changingMethod || newPaymentMethod === order.payment_method}
                                    style={{ background: "#eff6ff", color: "#1e40af", borderColor: "#bfdbfe" }}
                                >
                                    {changingMethod ? "..." : "Update"}
                                </button>
                            </div>
                        ) : (
                            <div style={{ padding: "0.5rem 0", color: "#6b7280", fontSize: "0.875rem" }}>
                                {order.payment_method || "—"} <em>(locked — order is {order.payment_status})</em>
                            </div>
                        )}
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Tracking Number</label>
                        <input
                            className={styles.formInput}
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            placeholder="e.g. 3SXXX0123456789"
                        />
                    </div>
                    <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                        <label className={styles.formLabel}>Tracking URL</label>
                        <input
                            className={styles.formInput}
                            value={trackingUrl}
                            onChange={(e) => setTrackingUrl(e.target.value)}
                            placeholder="e.g. https://tracking.dhl.de/..."
                        />
                    </div>
                    <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                        <label className={styles.formLabel}>Internal Notes</label>
                        <textarea
                            className={styles.formTextarea}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add notes about this order..."
                        />
                    </div>
                </div>
            </div>

            {/* Communication Log */}
            <div className={styles.formCard} style={{ maxWidth: "100%", marginTop: "1.5rem" }}>
                <h3 className={styles.formSectionTitle} style={{ marginTop: 0 }}>📧 Communication Log</h3>
                {comms.length === 0 ? (
                    <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>No emails sent yet</p>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {comms.map((comm) => {
                            const typeLabels: Record<string, { label: string; emoji: string; color: string }> = {
                                invoice: { label: "Invoice", emoji: "📄", color: "#2d5a3d" },
                                reminder_1: { label: "Reminder 1", emoji: "💚", color: "#2d5a3d" },
                                reminder_2: { label: "Reminder 2", emoji: "🟠", color: "#92400e" },
                                reminder_3: { label: "Final Notice", emoji: "🔴", color: "#991b1b" },
                            };
                            const meta = typeLabels[comm.type] || { label: comm.type, emoji: "📧", color: "#374151" };
                            const isExpanded = expandedComm === comm.id;

                            return (
                                <div key={comm.id} style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
                                    <button
                                        onClick={() => setExpandedComm(isExpanded ? null : comm.id)}
                                        style={{
                                            width: "100%", display: "flex", alignItems: "center", gap: "0.75rem",
                                            padding: "12px 16px", background: isExpanded ? "#f9fafb" : "#fff",
                                            border: "none", cursor: "pointer", textAlign: "left",
                                        }}
                                    >
                                        <span style={{ fontSize: "1.2rem" }}>{meta.emoji}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: "0.85rem", color: meta.color }}>{meta.label}</div>
                                            <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{comm.subject}</div>
                                        </div>
                                        <div style={{ fontSize: "0.75rem", color: "#9ca3af", whiteSpace: "nowrap" }}>
                                            {new Date(comm.sent_at).toLocaleString()}
                                        </div>
                                        <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>{isExpanded ? "▲" : "▼"}</span>
                                    </button>
                                    {isExpanded && (
                                        <div style={{ borderTop: "1px solid #e5e7eb" }}>
                                            <div style={{ padding: "8px 16px", background: "#f9fafb", fontSize: "0.75rem", color: "#6b7280" }}>
                                                To: {comm.recipient} · {new Date(comm.sent_at).toLocaleString()}
                                            </div>
                                            <iframe
                                                srcDoc={comm.html}
                                                style={{ width: "100%", height: "600px", border: "none", background: "#f3f4f6" }}
                                                title={`Email: ${comm.subject}`}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
