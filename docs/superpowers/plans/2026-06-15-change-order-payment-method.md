# Change Order Payment Method — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin change the payment method on an **unpaid** order, recalculating the invoice surcharge + total and (re)sending the invoice email when switching to `invoice`.

**Architecture:** A new server route `POST /api/admin/orders/[id]/change-payment-method` does the auth + guard + recalc + conditional invoice email (it needs the service-role client and Resend). The admin order detail page gets a payment-method dropdown + "Update" button that calls this endpoint, shown only when the order is unpaid/overdue.

**Tech Stack:** Next.js App Router route handlers, `@supabase/supabase-js` (service role) + `@supabase/ssr` (admin-session check), Resend (`buildInvoiceEmail` + `sendEmail`), React client component.

**Verification note:** This repo has **no test framework** (only `next build` + `eslint`). Each task is verified with `npx tsc --noEmit` (+ `npm run build` for the final task); real validation is the manual test plan in Task 3.

---

### Task 1: Create the change-payment-method endpoint

**Files:**
- Create: `src/app/api/admin/orders/[id]/change-payment-method/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/admin/orders/[id]/change-payment-method/route.ts`:

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

const VALID_METHODS = ["ideal", "creditcard", "bancontact", "sofortbanking", "invoice"];
const INVOICE_SURCHARGE = 1.99;

// Verify the caller is an admin via their Supabase session (admin_users table),
// the same check the /admin page middleware does. /api/admin/* is not behind it.
async function isAdmin(): Promise<boolean> {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll() { /* read-only: no session mutation needed */ },
            },
        }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return false;
    const { data: adminUser } = await supabaseAdmin
        .from("admin_users")
        .select("id")
        .eq("email", user.email)
        .single();
    return !!adminUser;
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: orderId } = await params;

    if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { paymentMethod?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const newMethod = body.paymentMethod;
    if (!newMethod || !VALID_METHODS.includes(newMethod)) {
        return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

    if (orderError || !order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!["unpaid", "overdue"].includes(order.payment_status)) {
        return NextResponse.json(
            { error: "Payment method can only be changed on unpaid orders" },
            { status: 409 }
        );
    }

    if (newMethod === order.payment_method) {
        return NextResponse.json({ success: true, message: "No change" });
    }

    const isInvoice = newMethod === "invoice";
    const wasInvoice = order.payment_method === "invoice";
    const invoiceSurcharge = isInvoice ? INVOICE_SURCHARGE : 0;
    const total =
        Number(order.subtotal) +
        Number(order.shipping_cost) +
        invoiceSurcharge -
        Number(order.discount_amount);

    const now = new Date();
    const update: Record<string, unknown> = {
        payment_method: newMethod,
        invoice_surcharge: invoiceSurcharge,
        total,
        updated_at: now.toISOString(),
    };

    if (isInvoice) {
        update.payment_due_date = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
        update.payment_status = "unpaid";
        update.reminder_count = 0;
        update.last_reminder_at = null;
        update.invoice_sent_at = now.toISOString();
    } else if (wasInvoice) {
        update.payment_due_date = null;
        update.reminder_count = 0;
        update.last_reminder_at = null;
    }

    const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update(update)
        .eq("id", orderId);

    if (updateError) {
        return NextResponse.json({ error: `Update failed: ${updateError.message}` }, { status: 500 });
    }

    let warning: string | undefined;
    if (isInvoice) {
        try {
            const { data: items } = await supabaseAdmin
                .from("order_items")
                .select("product_name, quantity, unit_price")
                .eq("order_id", orderId);

            const locale = order.language || "de";
            const addr = order.shipping_address;
            const addrStr = `${addr.first_name} ${addr.last_name}\n${addr.street} ${addr.house_number}\n${addr.postal_code} ${addr.city}\n${addr.country}`;
            const dueDateStr = new Date(update.payment_due_date as string).toLocaleDateString(
                locale === "de" ? "de-DE" : locale === "nl" ? "nl-NL" : "en-GB",
                { day: "2-digit", month: "long", year: "numeric" }
            );

            const html = buildInvoiceEmail({
                orderNumber: order.order_number,
                customerName: addr.first_name,
                items: (items || []).map((i) => ({
                    name: i.product_name,
                    quantity: i.quantity,
                    price: Number(i.unit_price),
                })),
                subtotal: Number(order.subtotal),
                shipping: Number(order.shipping_cost),
                discount: Number(order.discount_amount) > 0 ? Number(order.discount_amount) : undefined,
                invoiceSurcharge,
                total,
                shippingAddress: addrStr,
                paymentDueDate: dueDateStr,
                country: addr.country,
                locale,
            });

            const subjectMap: Record<string, string> = {
                de: `Rechnung #${order.order_number} - Dutch Green Alternative`,
                nl: `Factuur #${order.order_number} - Dutch Green Alternative`,
                en: `Invoice #${order.order_number} - Dutch Green Alternative`,
            };
            const subject = subjectMap[locale] || subjectMap.de;

            const sendResult = await sendEmail({ to: order.customer_email, subject, html });
            if (!sendResult.success) {
                warning = "Order updated, but the invoice email failed to send. Resend it manually.";
            } else {
                await supabaseAdmin.from("order_communications").insert({
                    order_id: orderId,
                    type: "invoice",
                    subject,
                    recipient: order.customer_email,
                    html,
                });
            }
        } catch (e) {
            console.error("[Change Payment Method] Invoice email error:", e);
            warning = "Order updated, but the invoice email failed to send. Resend it manually.";
        }
    }

    return NextResponse.json({ success: true, warning });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/orders/[id]/change-payment-method/route.ts"
git commit -m "feat(admin): add change-payment-method endpoint for unpaid orders

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Wire the admin order page UI

**Files:**
- Modify: `src/app/admin/orders/[id]/page.tsx`

- [ ] **Step 1: Add component state**

Find:
```tsx
    const [notes, setNotes] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("");
```
Replace with:
```tsx
    const [notes, setNotes] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("");
    const [newPaymentMethod, setNewPaymentMethod] = useState("");
    const [changingMethod, setChangingMethod] = useState(false);
```

- [ ] **Step 2: Initialize the method state in loadOrder**

Find:
```tsx
            setPaymentStatus(orderData.payment_status || "unpaid");
        }
```
Replace with:
```tsx
            setPaymentStatus(orderData.payment_status || "unpaid");
            setNewPaymentMethod(orderData.payment_method || "ideal");
        }
```

- [ ] **Step 3: Add the change-method handler**

Find the end of `handleMarkAsPaid` (the line `        setSaving(false);\n    };` that closes it) — it is immediately followed by `    const handleDelete = async () => {`. Insert the new handler between them. Specifically, find:
```tsx
        setSaving(false);
    };

    const handleDelete = async () => {
```
Replace with:
```tsx
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
```

- [ ] **Step 4: Add the payment-method control to the Manage Order grid**

Find the Payment Status form group:
```tsx
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Payment Status</label>
                        <select className={styles.formSelect} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                            {["unpaid", "paid", "overdue", "refunded"].map((s) => (
                                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                        </select>
                    </div>
```
Replace with (same block, plus a new Payment Method group after it):
```tsx
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
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npm run lint`
Expected: no NEW errors (the repo has ~60 pre-existing lint problems; none should be added).

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/orders/[id]/page.tsx"
git commit -m "feat(admin): payment-method dropdown on unpaid order detail page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Build + manual verification

**Files:** none (build + manual)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds; the route `/api/admin/orders/[id]/change-payment-method` appears in the build output.

- [ ] **Step 2: Push and deploy**

```bash
git push origin main
```
Wait for the Netlify production deploy to go green.

- [ ] **Step 3: Manual test — switch to invoice**

On `dutchgreenalternative.nl`, log in as admin, open an **unpaid, non-invoice** order:
1. In "Manage Order", set Payment Method to `invoice` → "Update" → confirm the dialog.
Expected: success message; page refreshes showing **Total +€1.99**, an "Invoice Fee €1.99" row, a Due Date ~14 days out, a new "Invoice" entry in the Communication Log; the customer receives the invoice email.

- [ ] **Step 4: Manual test — switch back to an online method**

On that now-invoice order, set Payment Method to `ideal` → "Update".
Expected: Total **−€1.99**, Invoice Fee row gone, Due Date cleared, **no** email sent.

- [ ] **Step 5: Manual test — guards**

1. Open a **paid** order → the Payment Method field shows read-only text "(locked — order is paid)", no dropdown.
2. With the order paid, calling the endpoint directly returns **409**:
   `curl -i -X POST https://dutchgreenalternative.nl/api/admin/orders/<paidOrderId>/change-payment-method -H "Content-Type: application/json" -d '{"paymentMethod":"invoice"}'`
   Expected: `409` with `"Payment method can only be changed on unpaid orders"` (or `401` if unauthenticated — confirming the admin guard).
3. Invalid method value → `400`.

- [ ] **Step 6: Manual test — locales**

Switch an unpaid order whose `language` is `nl` (or `de`) to invoice → the invoice email renders in that language.

---

## Self-Review

**Spec coverage:**
- New `POST /api/admin/orders/[id]/change-payment-method` with auth + guards + recalc + invoice fields + conditional invoice email → Task 1 ✓
- Admin dropdown gated to unpaid/overdue, read-only otherwise, with confirm on → invoice → Task 2 ✓
- Recalc `invoice_surcharge` + `total` from stored subtotal/shipping/discount → Task 1 Step 1 ✓
- → invoice sets due date / status unpaid / resets reminders / sends + logs invoice → Task 1 ✓
- → online from invoice clears due date / resets reminders / no email → Task 1 ✓
- CURO untouched, no re-billing, paid orders blocked → Task 1 (guard) + Task 2 (read-only) ✓
- Manual test plan incl. locales + guards → Task 3 ✓

**Placeholder scan:** No TBD/TODO; every step has complete code/commands.

**Type consistency:** `paymentMethod` body field, `VALID_METHODS`, and the five UI `<option>` values match. `buildInvoiceEmail` args match its `InvoiceData` type (`items: {name, quantity, price}`, `price` = unit price as the template multiplies by quantity). `newPaymentMethod`/`changingMethod` state names consistent between Task 2 steps. Endpoint path identical in route file and the page fetch.
