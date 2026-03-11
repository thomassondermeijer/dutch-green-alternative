"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../admin.module.css";

type Coupon = {
    id: string;
    code: string;
    description: string | null;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    max_discount_amount: number | null;
    min_order_amount: number | null;
    applies_to: "all" | "specific_products" | "specific_categories";
    product_ids: string[] | null;
    category_ids: string[] | null;
    first_order_only: boolean;
    per_customer_limit: number | null;
    usage_count: number;
    usage_limit: number | null;
    is_active: boolean;
    valid_from: string | null;
    valid_until: string | null;
};

type CouponUsage = {
    id: string;
    customer_email: string;
    discount_applied: number;
    used_at: string;
    order_id: string;
};

type Product = { id: string; slug: string; translations: Record<string, { name?: string }> };

const emptyCoupon: Omit<Coupon, "id" | "usage_count"> = {
    code: "",
    description: null,
    discount_type: "percentage",
    discount_value: 10,
    max_discount_amount: null,
    min_order_amount: null,
    applies_to: "all",
    product_ids: null,
    category_ids: null,
    first_order_only: false,
    per_customer_limit: null,
    usage_limit: null,
    is_active: true,
    valid_from: null,
    valid_until: null,
};

function generateCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "DGA-";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

export default function CouponsPage() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
    const [showModal, setShowModal] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
    const [form, setForm] = useState(emptyCoupon);
    const [saving, setSaving] = useState(false);
    const [expandedUsage, setExpandedUsage] = useState<string | null>(null);
    const [usageData, setUsageData] = useState<Record<string, CouponUsage[]>>({});
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const supabase = createClient();

    const loadCoupons = useCallback(async () => {
        const { data } = await supabase.from("coupons").select("*").order("code");
        setCoupons((data || []) as Coupon[]);
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        loadCoupons();
        supabase.from("products").select("id, slug, translations").then(({ data }) => {
            setProducts((data || []) as Product[]);
        });
    }, [loadCoupons, supabase]);

    const loadUsage = async (couponId: string) => {
        if (usageData[couponId]) {
            setExpandedUsage(expandedUsage === couponId ? null : couponId);
            return;
        }
        const { data } = await supabase
            .from("coupon_usage")
            .select("*")
            .eq("coupon_id", couponId)
            .order("used_at", { ascending: false });
        setUsageData((prev) => ({ ...prev, [couponId]: (data || []) as CouponUsage[] }));
        setExpandedUsage(couponId);
    };

    const openCreate = () => {
        setEditingCoupon(null);
        setForm({ ...emptyCoupon, code: generateCode() });
        setShowModal(true);
    };

    const openEdit = (c: Coupon) => {
        setEditingCoupon(c);
        setForm({
            code: c.code,
            description: c.description,
            discount_type: c.discount_type,
            discount_value: c.discount_value,
            max_discount_amount: c.max_discount_amount,
            min_order_amount: c.min_order_amount,
            applies_to: c.applies_to,
            product_ids: c.product_ids,
            category_ids: c.category_ids,
            first_order_only: c.first_order_only,
            per_customer_limit: c.per_customer_limit,
            usage_limit: c.usage_limit,
            is_active: c.is_active,
            valid_from: c.valid_from,
            valid_until: c.valid_until,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        setSaving(true);
        const payload = {
            code: form.code.toUpperCase(),
            description: form.description || null,
            discount_type: form.discount_type,
            discount_value: form.discount_value,
            max_discount_amount: form.max_discount_amount || null,
            min_order_amount: form.min_order_amount || null,
            applies_to: form.applies_to,
            product_ids: form.applies_to === "specific_products" ? form.product_ids : null,
            category_ids: form.applies_to === "specific_categories" ? form.category_ids : null,
            first_order_only: form.first_order_only,
            per_customer_limit: form.per_customer_limit || null,
            usage_limit: form.usage_limit || null,
            is_active: form.is_active,
            valid_from: form.valid_from || null,
            valid_until: form.valid_until || null,
        };

        if (editingCoupon) {
            await supabase.from("coupons").update(payload).eq("id", editingCoupon.id);
        } else {
            await supabase.from("coupons").insert(payload);
        }
        setSaving(false);
        setShowModal(false);
        loadCoupons();
    };

    const toggleActive = async (c: Coupon) => {
        await supabase.from("coupons").update({ is_active: !c.is_active }).eq("id", c.id);
        loadCoupons();
    };

    const handleDelete = async (id: string) => {
        await supabase.from("coupons").delete().eq("id", id);
        setDeleteConfirm(null);
        loadCoupons();
    };

    // Stats
    const activeCoupons = coupons.filter((c) => c.is_active);
    const totalUsage = coupons.reduce((sum, c) => sum + (c.usage_count || 0), 0);
    const mostUsed = coupons.reduce((best, c) => (c.usage_count > (best?.usage_count || 0) ? c : best), coupons[0]);

    // Filtered coupons
    const filtered = coupons.filter((c) => {
        if (search && !c.code.toLowerCase().includes(search.toLowerCase()) && !c.description?.toLowerCase().includes(search.toLowerCase())) return false;
        if (statusFilter === "active" && !c.is_active) return false;
        if (statusFilter === "inactive" && c.is_active) return false;
        return true;
    });

    const inputStyle: React.CSSProperties = {
        width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "8px",
        fontSize: "0.875rem", outline: "none",
    };
    const labelStyle: React.CSSProperties = { fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: "4px", display: "block" };

    return (
        <>
            {/* Stats Bar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
                {[
                    { label: "Total Coupons", value: coupons.length, icon: "🏷️" },
                    { label: "Active", value: activeCoupons.length, icon: "✅" },
                    { label: "Total Uses", value: totalUsage, icon: "📊" },
                    { label: "Most Used", value: mostUsed?.code || "—", icon: "🏆" },
                ].map((stat) => (
                    <div key={stat.label} className={styles.formCard} style={{ padding: "1rem", textAlign: "center", margin: 0 }}>
                        <div style={{ fontSize: "1.5rem" }}>{stat.icon}</div>
                        <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>{stat.value}</div>
                        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Header & Actions */}
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Coupons</h1>
                <button className={styles.primaryButton} onClick={openCreate}>+ Create Coupon</button>
            </div>

            {/* Search & Filter */}
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
                <input
                    type="text"
                    placeholder="Search by code or description..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ ...inputStyle, maxWidth: "300px" }}
                />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")} style={{ ...inputStyle, maxWidth: "150px" }}>
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>

            {/* Table */}
            {loading ? (
                <p style={{ color: "#6b7280" }}>Loading...</p>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
                    <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🏷️</p>
                    <p>{search || statusFilter !== "all" ? "No matching coupons" : "No coupons yet — create your first one!"}</p>
                </div>
            ) : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Discount</th>
                            <th>Rules</th>
                            <th>Usage</th>
                            <th>Status</th>
                            <th>Expires</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((c) => (
                            <>
                                <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => openEdit(c)}>
                                    <td>
                                        <span style={{ fontWeight: 600, fontFamily: "monospace", fontSize: "0.9rem" }}>{c.code}</span>
                                        {c.description && <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{c.description}</div>}
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: 600, color: "#059669" }}>
                                            {c.discount_type === "percentage" ? `${c.discount_value}%` : `€${Number(c.discount_value).toFixed(2)}`}
                                        </span>
                                        {c.max_discount_amount && <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>max €{Number(c.max_discount_amount).toFixed(2)}</div>}
                                    </td>
                                    <td style={{ fontSize: "0.75rem" }}>
                                        {c.min_order_amount ? <div>Min €{Number(c.min_order_amount).toFixed(2)}</div> : null}
                                        {c.first_order_only && <div style={{ color: "#7c3aed" }}>First order only</div>}
                                        {c.per_customer_limit && <div>Max {c.per_customer_limit}x/customer</div>}
                                        {c.applies_to !== "all" && <div style={{ color: "#2563eb" }}>{c.applies_to === "specific_products" ? "Product-specific" : "Category-specific"}</div>}
                                    </td>
                                    <td>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); loadUsage(c.id); }}
                                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", color: "#2563eb", textDecoration: "underline" }}
                                        >
                                            {c.usage_count || 0}{c.usage_limit ? ` / ${c.usage_limit}` : ""}
                                        </button>
                                    </td>
                                    <td>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleActive(c); }}
                                            style={{
                                                padding: "2px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600, border: "none", cursor: "pointer",
                                                background: c.is_active ? "#d1fae5" : "#fee2e2", color: c.is_active ? "#065f46" : "#991b1b",
                                            }}
                                        >
                                            {c.is_active ? "Active" : "Inactive"}
                                        </button>
                                    </td>
                                    <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                                        {c.valid_until ? new Date(c.valid_until).toLocaleDateString() : "Never"}
                                    </td>
                                    <td>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(c.id); }}
                                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "0.8rem" }}
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                                {/* Usage expansion */}
                                {expandedUsage === c.id && (
                                    <tr key={`usage-${c.id}`}>
                                        <td colSpan={7} style={{ background: "#f9fafb", padding: "12px 16px" }}>
                                            <strong style={{ fontSize: "0.8rem" }}>Usage History</strong>
                                            {(usageData[c.id] || []).length === 0 ? (
                                                <p style={{ color: "#9ca3af", fontSize: "0.8rem", margin: "8px 0 0" }}>No usage recorded yet</p>
                                            ) : (
                                                <table style={{ width: "100%", marginTop: "8px", fontSize: "0.8rem" }}>
                                                    <thead><tr><th style={{ textAlign: "left" }}>Customer</th><th>Discount</th><th>Date</th></tr></thead>
                                                    <tbody>
                                                        {usageData[c.id].map((u) => (
                                                            <tr key={u.id}>
                                                                <td>{u.customer_email}</td>
                                                                <td>€{Number(u.discount_applied).toFixed(2)}</td>
                                                                <td>{new Date(u.used_at).toLocaleString()}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Delete Confirmation */}
            {deleteConfirm && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                    <div style={{ background: "#fff", padding: "2rem", borderRadius: "12px", maxWidth: "400px", textAlign: "center" }}>
                        <p style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 1rem" }}>Delete this coupon?</p>
                        <p style={{ color: "#6b7280", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>This action cannot be undone. All usage history will also be deleted.</p>
                        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                            <button onClick={() => setDeleteConfirm(null)} style={{ padding: "8px 20px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} style={{ padding: "8px 20px", borderRadius: "8px", border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, overflow: "auto" }}>
                    <div style={{ background: "#fff", padding: "2rem", borderRadius: "12px", maxWidth: "600px", width: "90%", maxHeight: "90vh", overflow: "auto" }}>
                        <h2 style={{ margin: "0 0 1.5rem", fontSize: "1.2rem", fontWeight: 700 }}>
                            {editingCoupon ? "Edit Coupon" : "Create Coupon"}
                        </h2>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                            {/* Code */}
                            <div>
                                <label style={labelStyle}>Code</label>
                                <div style={{ display: "flex", gap: "4px" }}>
                                    <input style={{ ...inputStyle, textTransform: "uppercase", fontFamily: "monospace" }} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                                    <button onClick={() => setForm({ ...form, code: generateCode() })} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: "0.75rem", whiteSpace: "nowrap" }}>🎲</button>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label style={labelStyle}>Description (internal)</label>
                                <input style={inputStyle} placeholder="e.g. Summer sale 2026" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                            </div>

                            {/* Discount Type */}
                            <div>
                                <label style={labelStyle}>Discount Type</label>
                                <select style={inputStyle} value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as "percentage" | "fixed" })}>
                                    <option value="percentage">Percentage (%)</option>
                                    <option value="fixed">Fixed Amount (€)</option>
                                </select>
                            </div>

                            {/* Discount Value */}
                            <div>
                                <label style={labelStyle}>Discount Value</label>
                                <input type="number" style={inputStyle} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} />
                            </div>

                            {/* Max Discount (for percentage) */}
                            {form.discount_type === "percentage" && (
                                <div>
                                    <label style={labelStyle}>Max Discount Cap (€)</label>
                                    <input type="number" style={inputStyle} placeholder="No cap" value={form.max_discount_amount || ""} onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value ? Number(e.target.value) : null })} />
                                </div>
                            )}

                            {/* Min Order */}
                            <div>
                                <label style={labelStyle}>Min Order Amount (€)</label>
                                <input type="number" style={inputStyle} placeholder="No minimum" value={form.min_order_amount || ""} onChange={(e) => setForm({ ...form, min_order_amount: e.target.value ? Number(e.target.value) : null })} />
                            </div>

                            {/* Usage Limit */}
                            <div>
                                <label style={labelStyle}>Total Usage Limit</label>
                                <input type="number" style={inputStyle} placeholder="Unlimited" value={form.usage_limit || ""} onChange={(e) => setForm({ ...form, usage_limit: e.target.value ? Number(e.target.value) : null })} />
                            </div>

                            {/* Per Customer Limit */}
                            <div>
                                <label style={labelStyle}>Per Customer Limit</label>
                                <input type="number" style={inputStyle} placeholder="Unlimited" value={form.per_customer_limit || ""} onChange={(e) => setForm({ ...form, per_customer_limit: e.target.value ? Number(e.target.value) : null })} />
                            </div>

                            {/* Valid Until */}
                            <div>
                                <label style={labelStyle}>Expires</label>
                                <input type="date" style={inputStyle} value={form.valid_until ? form.valid_until.split("T")[0] : ""} onChange={(e) => setForm({ ...form, valid_until: e.target.value ? `${e.target.value}T23:59:59Z` : null })} />
                            </div>

                            {/* Applies To */}
                            <div>
                                <label style={labelStyle}>Applies To</label>
                                <select style={inputStyle} value={form.applies_to} onChange={(e) => setForm({ ...form, applies_to: e.target.value as "all" | "specific_products" | "specific_categories" })}>
                                    <option value="all">All Products</option>
                                    <option value="specific_products">Specific Products</option>
                                    <option value="specific_categories">Specific Categories</option>
                                </select>
                            </div>
                        </div>

                        {/* Product Selection */}
                        {form.applies_to === "specific_products" && (
                            <div style={{ marginTop: "1rem" }}>
                                <label style={labelStyle}>Select Products</label>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                    {products.map((p) => {
                                        const name = p.translations?.de?.name || p.slug;
                                        const selected = (form.product_ids || []).includes(p.id);
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    const ids = form.product_ids || [];
                                                    setForm({ ...form, product_ids: selected ? ids.filter((id) => id !== p.id) : [...ids, p.id] });
                                                }}
                                                style={{
                                                    padding: "4px 12px", borderRadius: "20px", fontSize: "0.75rem", cursor: "pointer",
                                                    border: selected ? "2px solid #2563eb" : "1px solid #d1d5db",
                                                    background: selected ? "#eff6ff" : "#fff", color: selected ? "#2563eb" : "#374151", fontWeight: selected ? 600 : 400,
                                                }}
                                            >
                                                {name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Category Selection */}
                        {form.applies_to === "specific_categories" && (
                            <div style={{ marginTop: "1rem" }}>
                                <label style={labelStyle}>Select Categories</label>
                                <div style={{ display: "flex", gap: "6px" }}>
                                    {["raw", "pure_formula"].map((cat) => {
                                        const selected = (form.category_ids || []).includes(cat);
                                        return (
                                            <button
                                                key={cat}
                                                onClick={() => {
                                                    const ids = form.category_ids || [];
                                                    setForm({ ...form, category_ids: selected ? ids.filter((id) => id !== cat) : [...ids, cat] });
                                                }}
                                                style={{
                                                    padding: "6px 16px", borderRadius: "20px", fontSize: "0.8rem", cursor: "pointer",
                                                    border: selected ? "2px solid #2563eb" : "1px solid #d1d5db",
                                                    background: selected ? "#eff6ff" : "#fff", color: selected ? "#2563eb" : "#374151", fontWeight: selected ? 600 : 400,
                                                }}
                                            >
                                                {cat === "raw" ? "RAW CBD & CBG" : "Pure Formula+"}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Toggles */}
                        <div style={{ marginTop: "1.25rem", display: "flex", gap: "1.5rem" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", cursor: "pointer" }}>
                                <input type="checkbox" checked={form.first_order_only} onChange={(e) => setForm({ ...form, first_order_only: e.target.checked })} />
                                First order only
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", cursor: "pointer" }}>
                                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                                Active
                            </label>
                        </div>

                        {/* Actions */}
                        <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                            <button onClick={() => setShowModal(false)} style={{ padding: "10px 24px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>Cancel</button>
                            <button onClick={handleSave} disabled={saving || !form.code.trim()} style={{ padding: "10px 24px", borderRadius: "8px", border: "none", background: "#2d5a3d", color: "#fff", cursor: "pointer", fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
                                {saving ? "Saving..." : editingCoupon ? "Update Coupon" : "Create Coupon"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
