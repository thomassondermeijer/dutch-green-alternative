"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../../admin.module.css";

type Product = { id: string; price: number; name: string };
type LineItem = { productId: string; quantity: number };
type Addr = { street: string; houseNumber: string; postalCode: string; city: string; country: string };

const emptyAddr: Addr = { street: "", houseNumber: "", postalCode: "", city: "", country: "DE" };
const COUNTRIES = [["DE", "Germany"], ["NL", "Netherlands"], ["BE", "Belgium"], ["FR", "France"]];

export default function NewOrderPage() {
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [productsLoading, setProductsLoading] = useState(true);

    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");

    const [shipping, setShipping] = useState<Addr>({ ...emptyAddr });
    const [sameBilling, setSameBilling] = useState(true);
    const [billing, setBilling] = useState<Addr>({ ...emptyAddr });

    const [items, setItems] = useState<LineItem[]>([]);
    const [pickProductId, setPickProductId] = useState("");

    const [shippingCostOverride, setShippingCostOverride] = useState<number | null>(null);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [invoiceFee, setInvoiceFee] = useState(true);
    const [language, setLanguage] = useState<"de" | "nl" | "en">("de");

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const supabase = createClient();
        supabase.from("products").select("id, price, translations").eq("is_active", true).order("sort_order")
            .then(({ data }) => {
                const list: Product[] = (data || []).map((p: { id: string; price: number; translations: Record<string, { name?: string }> | null }) => ({
                    id: p.id,
                    price: Number(p.price),
                    name: p.translations?.de?.name || p.translations?.en?.name || p.id,
                }));
                setProducts(list);
                setProductsLoading(false);
            });
    }, []);

    const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
    const subtotal = useMemo(
        () => items.reduce((sum, li) => sum + (productById[li.productId]?.price || 0) * li.quantity, 0),
        [items, productById]
    );

    const shippingCost = shippingCostOverride !== null ? shippingCostOverride : (subtotal >= 65 ? 0 : 4.95);
    const setShippingCost = (v: number) => setShippingCostOverride(v);

    const total = subtotal + (Number(shippingCost) || 0) + (invoiceFee ? 1.99 : 0) - (Number(discountAmount) || 0);

    const addProduct = () => {
        if (!pickProductId) return;
        setItems((prev) => {
            const existing = prev.find((li) => li.productId === pickProductId);
            if (existing) return prev.map((li) => li.productId === pickProductId ? { ...li, quantity: li.quantity + 1 } : li);
            return [...prev, { productId: pickProductId, quantity: 1 }];
        });
        setPickProductId("");
    };
    const setQty = (productId: string, qty: number) =>
        setItems((prev) => prev.map((li) => li.productId === productId ? { ...li, quantity: Math.max(1, qty) } : li));
    const removeItem = (productId: string) =>
        setItems((prev) => prev.filter((li) => li.productId !== productId));

    const addrInput = (addr: Addr, set: (a: Addr) => void, key: keyof Addr, label: string) => (
        <div className={styles.formGroup}>
            <label className={styles.formLabel}>{label}</label>
            {key === "country" ? (
                <select className={styles.formSelect} value={addr.country} onChange={(e) => set({ ...addr, country: e.target.value })}>
                    {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
            ) : (
                <input className={styles.formInput} value={addr[key]} onChange={(e) => set({ ...addr, [key]: e.target.value })} />
            )}
        </div>
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (items.length === 0) { setError("Add at least one product."); return; }
        setSubmitting(true);
        try {
            const res = await fetch("/api/admin/orders/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email, firstName, lastName, phone,
                    shipping,
                    billing: sameBilling ? null : billing,
                    items,
                    shippingCost: Number(shippingCost) || 0,
                    discountAmount: Number(discountAmount) || 0,
                    invoiceFee,
                    language,
                }),
            });
            const result = await res.json();
            if (res.ok && result.success) {
                if (result.warning) window.alert(result.warning);
                router.push(`/admin/orders/${result.orderId}`);
            } else {
                setError(result.error || "Failed to create order");
                setSubmitting(false);
            }
        } catch {
            setError("Network error");
            setSubmitting(false);
        }
    };

    return (
        <>
            <div className={styles.pageHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1 className={styles.pageTitle}>New Order</h1>
                <button className={styles.actionBtn} onClick={() => router.push("/admin/orders")}>← Back</button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <form onSubmit={handleSubmit}>
                {/* Customer */}
                <div className={styles.formCard} style={{ maxWidth: "100%", marginBottom: "1.5rem" }}>
                    <h3 className={styles.formSectionTitle} style={{ marginTop: 0 }}>Customer</h3>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Email *</label>
                            <input className={styles.formInput} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Phone</label>
                            <input className={styles.formInput} value={phone} onChange={(e) => setPhone(e.target.value)} />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>First name *</label>
                            <input className={styles.formInput} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Last name *</label>
                            <input className={styles.formInput} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Language</label>
                            <select className={styles.formSelect} value={language} onChange={(e) => setLanguage(e.target.value as "de" | "nl" | "en")}>
                                <option value="de">DE</option>
                                <option value="nl">NL</option>
                                <option value="en">EN</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Shipping address */}
                <div className={styles.formCard} style={{ maxWidth: "100%", marginBottom: "1.5rem" }}>
                    <h3 className={styles.formSectionTitle} style={{ marginTop: 0 }}>Shipping Address</h3>
                    <div className={styles.formGrid}>
                        {addrInput(shipping, setShipping, "street", "Street")}
                        {addrInput(shipping, setShipping, "houseNumber", "House number")}
                        {addrInput(shipping, setShipping, "postalCode", "Postal code")}
                        {addrInput(shipping, setShipping, "city", "City")}
                        {addrInput(shipping, setShipping, "country", "Country")}
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
                        <input type="checkbox" checked={sameBilling} onChange={(e) => setSameBilling(e.target.checked)} />
                        Billing address same as shipping
                    </label>
                </div>

                {/* Billing address */}
                {!sameBilling && (
                    <div className={styles.formCard} style={{ maxWidth: "100%", marginBottom: "1.5rem" }}>
                        <h3 className={styles.formSectionTitle} style={{ marginTop: 0 }}>Billing Address</h3>
                        <div className={styles.formGrid}>
                            {addrInput(billing, setBilling, "street", "Street")}
                            {addrInput(billing, setBilling, "houseNumber", "House number")}
                            {addrInput(billing, setBilling, "postalCode", "Postal code")}
                            {addrInput(billing, setBilling, "city", "City")}
                            {addrInput(billing, setBilling, "country", "Country")}
                        </div>
                    </div>
                )}

                {/* Products */}
                <div className={styles.formCard} style={{ maxWidth: "100%", marginBottom: "1.5rem" }}>
                    <h3 className={styles.formSectionTitle} style={{ marginTop: 0 }}>Products</h3>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                        <select className={styles.formSelect} value={pickProductId} onChange={(e) => setPickProductId(e.target.value)} style={{ flex: 1 }} disabled={productsLoading}>
                            <option value="">{productsLoading ? "Loading products…" : "— Select a product —"}</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.name} — €{p.price.toFixed(2)}</option>)}
                        </select>
                        <button type="button" className={styles.actionBtn} onClick={addProduct} disabled={!pickProductId}>Add</button>
                    </div>
                    {items.length === 0 ? (
                        <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>No products added yet.</p>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr><th>Product</th><th style={{ textAlign: "center" }}>Qty</th><th style={{ textAlign: "right" }}>Unit</th><th style={{ textAlign: "right" }}>Line</th><th></th></tr>
                            </thead>
                            <tbody>
                                {items.map((li) => {
                                    const p = productById[li.productId];
                                    return (
                                        <tr key={li.productId}>
                                            <td>{p?.name || li.productId}</td>
                                            <td style={{ textAlign: "center" }}>
                                                <input type="number" min={1} value={li.quantity}
                                                    onChange={(e) => setQty(li.productId, parseInt(e.target.value) || 1)}
                                                    style={{ width: "60px", textAlign: "center" }} />
                                            </td>
                                            <td style={{ textAlign: "right" }}>€{(p?.price || 0).toFixed(2)}</td>
                                            <td style={{ textAlign: "right" }}>€{((p?.price || 0) * li.quantity).toFixed(2)}</td>
                                            <td style={{ textAlign: "right" }}>
                                                <button type="button" className={styles.actionBtn} onClick={() => removeItem(li.productId)} style={{ background: "#fef2f2", color: "#991b1b", borderColor: "#fecaca" }}>Remove</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pricing */}
                <div className={styles.formCard} style={{ maxWidth: "100%", marginBottom: "1.5rem" }}>
                    <h3 className={styles.formSectionTitle} style={{ marginTop: 0 }}>Pricing</h3>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Subtotal</label>
                            <input className={styles.formInput} value={`€${subtotal.toFixed(2)}`} readOnly />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Shipping (€)</label>
                            <input className={styles.formInput} type="number" step="0.01" min={0} value={shippingCost}
                                onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Discount (€)</label>
                            <input className={styles.formInput} type="number" step="0.01" min={0} value={discountAmount}
                                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Invoice fee</label>
                            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingTop: "0.5rem" }}>
                                <input type="checkbox" checked={invoiceFee} onChange={(e) => setInvoiceFee(e.target.checked)} />
                                Add €1.99 invoice fee
                            </label>
                        </div>
                    </div>
                    <p style={{ fontSize: "1.1rem", fontWeight: 700, textAlign: "right", marginTop: "1rem" }}>
                        Total: €{total.toFixed(2)}
                    </p>
                </div>

                <button type="submit" className={styles.actionBtn} disabled={submitting}
                    style={{ background: "#f0fdf4", color: "#065f46", borderColor: "#bbf7d0", fontSize: "1rem", padding: "0.75rem 1.5rem" }}>
                    {submitting ? "Creating…" : "Create Order & Send Invoice"}
                </button>
            </form>
        </>
    );
}
