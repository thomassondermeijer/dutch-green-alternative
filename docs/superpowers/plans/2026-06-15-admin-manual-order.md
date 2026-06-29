# Admin Manual (Invoice) Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin create a new invoice order by hand — a "New Order" form + a self-contained create endpoint that reuses the invoice email and reminder cron.

**Architecture:** A new admin-auth'd `POST /api/admin/orders/create` recomputes totals server-side from real product prices, upserts the customer, creates the order + items as `payment_method="invoice"`, and sends the invoice email. A new `/admin/orders/new` client form (product picker + editable pricing) calls it. Checkout's payment path is left untouched (the endpoint is self-contained).

**Tech Stack:** Next.js App Router route handlers, `@supabase/supabase-js` (service role) + `@supabase/ssr` (admin check), Resend (`buildInvoiceEmail`/`sendEmail`), React client component.

**Verification note:** No test framework (only `next build` + `eslint`). Each task verifies with `npx tsc --noEmit` (+ `npm run build` at the end); real validation is the manual run-through in Task 4.

**Key data facts:**
- `products` has **no `name` column** — names are in `translations` jsonb: `translations.de.name` / `.nl.name` / `.en.name`. Columns used: `id`, `slug`, `price`, `translations`, `is_active`, `sort_order`.
- `order_items` columns: `order_id`, `product_id`, `product_name`, `quantity`, `unit_price`, `total_price`.
- `customers` has `email`, `first_name`, `last_name`, `phone`, `language_pref`, `addresses` (jsonb array).
- Order number scheme: `DGA-YYYYMMDD-NNN` (count of today's orders + 1).

---

### Task 1: Create the manual-order endpoint

**Files:**
- Create: `src/app/api/admin/orders/create/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/admin/orders/create/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { buildInvoiceEmail } from "@/lib/resend/templates/invoice";
import { sendEmail } from "@/lib/resend/client";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const INVOICE_SURCHARGE = 1.99;

async function isAdmin(): Promise<boolean> {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll() { /* read-only */ },
            },
        }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return false;
    const { data: adminUser } = await supabaseAdmin
        .from("admin_users").select("id").eq("email", user.email).single();
    return !!adminUser;
}

type Addr = { street: string; houseNumber: string; postalCode: string; city: string; country: string };
type CreateBody = {
    email: string; firstName: string; lastName: string; phone?: string;
    shipping: Addr; billing?: Addr | null;
    items: { productId: string; quantity: number }[];
    shippingCost: number; discountAmount: number; invoiceFee: boolean;
    language: "de" | "nl" | "en";
};

function addrToColumns(a: Addr) {
    return {
        first_name: "", last_name: "",
        street: a.street, house_number: a.houseNumber,
        city: a.city, postal_code: a.postalCode, country: a.country,
    };
}

export async function POST(req: NextRequest) {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: CreateBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Validate
    if (!body.email || !body.firstName || !body.lastName) {
        return NextResponse.json({ error: "Email, first name and last name are required" }, { status: 400 });
    }
    const s = body.shipping;
    if (!s || !s.street || !s.houseNumber || !s.postalCode || !s.city || !s.country) {
        return NextResponse.json({ error: "Complete shipping address is required" }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json({ error: "Add at least one product" }, { status: 400 });
    }
    const language = ["de", "nl", "en"].includes(body.language) ? body.language : "de";
    const shippingCost = Math.max(0, Number(body.shippingCost) || 0);
    const discountAmount = Math.max(0, Number(body.discountAmount) || 0);
    const invoiceSurcharge = body.invoiceFee ? INVOICE_SURCHARGE : 0;

    // Look up products by id (authoritative prices + names)
    const ids = [...new Set(body.items.map((i) => i.productId))];
    const { data: products, error: prodErr } = await supabaseAdmin
        .from("products").select("id, slug, price, translations").in("id", ids);
    if (prodErr) {
        return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
    }
    const productMap = new Map((products || []).map((p) => [p.id, p]));

    const lineItems: { product_id: string; product_name: string; quantity: number; unit_price: number; total_price: number }[] = [];
    for (const item of body.items) {
        const p = productMap.get(item.productId);
        if (!p) {
            return NextResponse.json({ error: `Unknown product: ${item.productId}` }, { status: 400 });
        }
        const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const unitPrice = Number(p.price);
        const tr = (p.translations || {}) as Record<string, { name?: string }>;
        const name = tr[language]?.name || tr.de?.name || p.slug;
        lineItems.push({
            product_id: p.id, product_name: name, quantity: qty,
            unit_price: unitPrice, total_price: unitPrice * qty,
        });
    }

    const subtotal = lineItems.reduce((sum, li) => sum + li.total_price, 0);
    const total = subtotal + shippingCost + invoiceSurcharge - discountAmount;

    // Upsert customer by email
    const shippingCols = { ...addrToColumns(s), first_name: body.firstName, last_name: body.lastName };
    let customerId: string;
    const { data: existing } = await supabaseAdmin
        .from("customers").select("id").eq("email", body.email).limit(1).maybeSingle();
    if (existing) {
        customerId = existing.id;
        await supabaseAdmin.from("customers").update({
            first_name: body.firstName, last_name: body.lastName, phone: body.phone || null,
            language_pref: language, addresses: [shippingCols], updated_at: new Date().toISOString(),
        }).eq("id", customerId);
    } else {
        const { data: created, error: custErr } = await supabaseAdmin.from("customers").insert({
            email: body.email, first_name: body.firstName, last_name: body.lastName,
            phone: body.phone || null, language_pref: language, addresses: [shippingCols],
        }).select("id").single();
        if (custErr || !created) {
            return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
        }
        customerId = created.id;
    }

    // Generate order number DGA-YYYYMMDD-NNN
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const { data: todays } = await supabaseAdmin
        .from("orders").select("id").like("order_number", `DGA-${dateStr}-%`);
    const orderNumber = `DGA-${dateStr}-${String((todays?.length || 0) + 1).padStart(3, "0")}`;

    // Build addresses
    const shippingAddress = { ...addrToColumns(s), first_name: body.firstName, last_name: body.lastName };
    const billingAddress = body.billing
        ? { ...addrToColumns(body.billing), first_name: body.firstName, last_name: body.lastName }
        : shippingAddress;

    const now = new Date();
    const dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Insert order
    const { data: order, error: orderErr } = await supabaseAdmin.from("orders").insert({
        order_number: orderNumber,
        customer_id: customerId,
        customer_email: body.email,
        status: "pending",
        subtotal,
        shipping_cost: shippingCost,
        discount_amount: discountAmount,
        total,
        shipping_address: shippingAddress,
        billing_address: billingAddress,
        language,
        payment_method: "invoice",
        invoice_surcharge: invoiceSurcharge,
        payment_status: "unpaid",
        payment_due_date: dueDate.toISOString(),
        invoice_sent_at: now.toISOString(),
    }).select("id").single();

    if (orderErr || !order) {
        return NextResponse.json({ error: `Failed to create order: ${orderErr?.message || ""}` }, { status: 500 });
    }

    // Insert order items
    await supabaseAdmin.from("order_items").insert(
        lineItems.map((li) => ({ ...li, order_id: order.id }))
    );

    // Send invoice email
    let warning: string | undefined;
    try {
        const addrStr = `${body.firstName} ${body.lastName}\n${s.street} ${s.houseNumber}\n${s.postalCode} ${s.city}\n${s.country}`;
        const dueDateStr = dueDate.toLocaleDateString(
            language === "de" ? "de-DE" : language === "nl" ? "nl-NL" : "en-GB",
            { day: "2-digit", month: "long", year: "numeric" }
        );
        const html = buildInvoiceEmail({
            orderNumber,
            customerName: body.firstName,
            items: lineItems.map((li) => ({ name: li.product_name, quantity: li.quantity, price: li.unit_price })),
            subtotal,
            shipping: shippingCost,
            discount: discountAmount > 0 ? discountAmount : undefined,
            invoiceSurcharge,
            total,
            shippingAddress: addrStr,
            paymentDueDate: dueDateStr,
            country: s.country,
            locale: language,
        });
        const subjectMap: Record<string, string> = {
            de: `Rechnung #${orderNumber} - Dutch Green Alternative`,
            nl: `Factuur #${orderNumber} - Dutch Green Alternative`,
            en: `Invoice #${orderNumber} - Dutch Green Alternative`,
        };
        const subject = subjectMap[language] || subjectMap.de;
        const sendResult = await sendEmail({ to: body.email, subject, html });
        if (!sendResult.success) {
            const suppressed = "suppressed" in sendResult && sendResult.suppressed;
            warning = suppressed
                ? "Order created. Invoice email skipped — the customer's address is on the suppression list."
                : "Order created, but the invoice email failed to send. Resend it manually.";
        } else {
            const { error: logError } = await supabaseAdmin.from("order_communications").insert({
                order_id: order.id, type: "invoice", subject, recipient: body.email, html,
            });
            if (logError) console.error("[Create Order] Failed to log communication:", logError);
        }
    } catch (e) {
        console.error("[Create Order] Invoice email error:", e);
        warning = "Order created, but the invoice email failed to send. Resend it manually.";
    }

    return NextResponse.json({ success: true, orderId: order.id, orderNumber, warning });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/orders/create/route.ts"
git commit -m "feat(admin): add manual invoice-order create endpoint

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Create the New Order form page

**Files:**
- Create: `src/app/admin/orders/new/page.tsx`

- [ ] **Step 1: Write the page**

Create `src/app/admin/orders/new/page.tsx`:

```tsx
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

    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");

    const [shipping, setShipping] = useState<Addr>({ ...emptyAddr });
    const [sameBilling, setSameBilling] = useState(true);
    const [billing, setBilling] = useState<Addr>({ ...emptyAddr });

    const [items, setItems] = useState<LineItem[]>([]);
    const [pickProductId, setPickProductId] = useState("");

    const [shippingCost, setShippingCost] = useState(4.95);
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
            });
    }, []);

    const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
    const subtotal = useMemo(
        () => items.reduce((sum, li) => sum + (productById[li.productId]?.price || 0) * li.quantity, 0),
        [items, productById]
    );

    useEffect(() => {
        setShippingCost(subtotal >= 65 ? 0 : 4.95);
    }, [subtotal]);

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
                        <select className={styles.formSelect} value={pickProductId} onChange={(e) => setPickProductId(e.target.value)} style={{ flex: 1 }}>
                            <option value="">— Select a product —</option>
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
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npm run lint`
Expected: no NEW errors (≈60 pre-existing problems are fine).

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/orders/new/page.tsx"
git commit -m "feat(admin): add New Order form (manual invoice order)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add the "+ New Order" button to the orders list

**Files:**
- Modify: `src/app/admin/orders/page.tsx`

- [ ] **Step 1: Add the Link import**

Find:
```tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
```
Replace with:
```tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
```

- [ ] **Step 2: Add the button to the page header**

Find:
```tsx
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Orders</h1>
            </div>
```
Replace with:
```tsx
            <div className={styles.pageHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1 className={styles.pageTitle}>Orders</h1>
                <Link href="/admin/orders/new" className={styles.actionBtn} style={{ background: "#f0fdf4", color: "#065f46", borderColor: "#bbf7d0" }}>
                    + New Order
                </Link>
            </div>
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npm run lint`
Expected: no NEW errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/orders/page.tsx"
git commit -m "feat(admin): add New Order button to orders list

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Build + manual verification

**Files:** none (build + manual)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds; routes `/admin/orders/new` and `/api/admin/orders/create` appear in the output.

- [ ] **Step 2: Push and deploy**

```bash
git push origin main
```
Wait for the Netlify production deploy to go green.

- [ ] **Step 3: Manual test — happy path** (admin on `dutchgreenalternative.nl`)

1. `/admin/orders` → "+ New Order".
2. Fill email/name, a shipping address, add 2 products (leave defaults), Create.
Expected: redirected to the new order's detail page; `payment_method=invoice`, `payment_status=unpaid`, total = subtotal + €4.95 (or Free ≥ €65) + €1.99 − discount; Due Date ~14 days out; an "Invoice" entry in the Communication Log; the customer receives the invoice email.

- [ ] **Step 4: Manual test — editable pricing**

Create another order: set Shipping to `0`, untick the invoice fee, add a €5 discount.
Expected: Total = subtotal − 5; the order's `shipping_cost=0`, `invoice_surcharge=0`, `discount_amount=5` reflect this.

- [ ] **Step 5: Manual test — existing customer + locale + guard**

1. Use the email of an existing customer → no duplicate customer row is created (it updates).
2. Set Language = `nl` → the invoice email renders in Dutch.
3. Logged out, POST to `/api/admin/orders/create` → 401.

---

## Self-Review

**Spec coverage:**
- `POST /api/admin/orders/create` with auth, server-recomputed totals, customer upsert, invoice fields, invoice email → Task 1 ✓
- `/admin/orders/new` form: customer + address + product picker + editable shipping/discount/€1.99-fee + language → Task 2 ✓
- "+ New Order" button on the list → Task 3 ✓
- Always `payment_method=invoice`, 14-day due date, reminder cron inherits it → Task 1 (order insert) ✓
- Out of scope (no pay-link / mark-paid / coupon) honored — none added ✓
- Manual test incl. existing-customer, locale, 401 guard → Task 4 ✓

**Placeholder scan:** No TBD/TODO; every step has complete code/commands.

**Type consistency:** The request body shape (`email/firstName/lastName/phone/shipping/billing/items[{productId,quantity}]/shippingCost/discountAmount/invoiceFee/language`) is identical in the form's `fetch` (Task 2) and the endpoint's `CreateBody` (Task 1). `Addr` fields (`street/houseNumber/postalCode/city/country`) match between form and endpoint. Product name resolved from `translations[lang].name` in both. `buildInvoiceEmail` args match its `InvoiceData` type (`items: {name, quantity, price}`, price = unit price). Endpoint path `/api/admin/orders/create` identical in the form fetch and the route file.
