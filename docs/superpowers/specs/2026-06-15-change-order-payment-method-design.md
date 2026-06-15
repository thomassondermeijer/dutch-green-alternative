# Admin: Change Payment Method on an Existing Order — Design

**Date:** 2026-06-15
**Status:** Approved (pending spec review)

## Problem

`payment_method` is set once at checkout ([checkout/route.ts:300](../../../src/app/api/checkout/route.ts)) and can't be changed afterward — not in admin, not by customers. Admins need to correct/change the payment method on an existing (unpaid) order, e.g. a customer who chose an online method but wants to pay by invoice, or a data correction.

## Scope (Option A — admin, data-only)

In scope:
- Admin changes an order's `payment_method` from the admin order detail page.
- The order's `invoice_surcharge` and `total` are recalculated.
- When the new method is `invoice`, the invoice email is (re)sent with the new total + a fresh 14-day due date.

Explicitly **out of scope**:
- No CURO re-billing / new online payment link (that's Option B). `curo_transaction_id` is left untouched (historical).
- No customer email except the invoice resend.
- No changing of paid / refunded / cancelled orders.
- No customer self-service.

## Decisions (from brainstorming)

1. **Customer comms:** data-only, **except** auto-(re)send the invoice email when switching **to** `invoice`. No email for other transitions.
2. **Eligibility:** allowed only when `payment_status ∈ {unpaid, overdue}`. Paid/refunded/cancelled orders keep the method read-only. Enforced on both client (control disabled) and server (endpoint rejects).
3. Switching **to invoice** resets the reminder cycle (`reminder_count = 0`, `last_reminder_at = null`, fresh `payment_due_date`) and sets `payment_status = "unpaid"` (clears an `overdue` state).
4. **No separate audit log** in v1 (the invoice resend already logs to `order_communications`).

## Valid payment methods

`ideal`, `creditcard`, `bancontact`, `sofortbanking`, `invoice`.

## Architecture

### New endpoint: `POST /api/admin/orders/[id]/change-payment-method`

File: `src/app/api/admin/orders/[id]/change-payment-method/route.ts`

The recalculation + conditional invoice email need the server (service-role + Resend), so this lives in a route rather than the page's existing client-side `.update()`.

Request body: `{ paymentMethod: string }`.

Logic:
1. **Auth:** verify the caller is an admin. Use `createServerClient` (`@supabase/ssr`) to read the session and confirm the user's email is in `admin_users` (same check the page-protecting middleware does for `/admin`). `/api/admin/*` is not behind that middleware, so the endpoint guards itself. Return 401/403 otherwise.
2. **Load order** by `id` (service-role client). 404 if missing.
3. **Guards:**
   - `payment_status` must be `unpaid` or `overdue` → else 409 with a clear message.
   - `paymentMethod` must be one of the five valid values → else 400.
   - If `paymentMethod === order.payment_method`, no-op success (nothing to change).
4. **Recalculate** from the order's stored numbers:
   - `invoice_surcharge = paymentMethod === "invoice" ? 1.99 : 0`
   - `total = subtotal + shipping_cost + invoice_surcharge − discount_amount`
5. **Build the update:**
   - Always: `payment_method`, `invoice_surcharge`, `total`.
   - If new method is `invoice`: `payment_due_date = now + 14d`, `payment_status = "unpaid"`, `reminder_count = 0`, `last_reminder_at = null`, `invoice_sent_at = now`.
   - If old method was `invoice` and new is online: `payment_due_date = null`, `reminder_count = 0`, `last_reminder_at = null`.
6. **PATCH** the order (service-role).
7. **If new method is `invoice`:** send the invoice email via `buildInvoiceEmail` + `sendEmail` (reusing the checkout invoice flow's inputs: order items, recalculated subtotal/shipping/discount/surcharge/total, shipping address string, localized due date, `order.language`), then insert an `order_communications` row (`type: "invoice"`).
8. Return `{ success: true, order: <updated fields incl. new total> }`.

Order items for the invoice email are read from `order_items` for the order.

### Admin UI change

File: `src/app/admin/orders/[id]/page.tsx`

- Replace the read-only `payment_method` display with a `<select>` of the five methods **when `payment_status ∈ {unpaid, overdue}`**; otherwise keep the read-only text.
- A "Save payment method" button calls the new endpoint. If the chosen method is `invoice`, show a confirm first: "This resends the invoice email with the updated total and a new 14-day due date."
- On success, refresh the order data (re-fetch) so the recalculated `total`, `invoice_surcharge`, and `payment_due_date` display correctly, and show a success message. On error, show the endpoint's message.
- This control is separate from the existing client-side `.update()` save (status/tracking/notes) — it has its own button and goes through the endpoint.

## Data flow

```
Admin picks new method → "Save payment method"
  → (if → invoice) confirm dialog
  → POST /api/admin/orders/{id}/change-payment-method { paymentMethod }
     → auth (admin_users) → load order → guard (unpaid/overdue, valid method)
     → recalc surcharge + total → PATCH order (+ invoice fields if applicable)
     → if invoice: send invoice email + log to order_communications
  → page re-fetches order → shows new total / due date / success
```

## Error handling

- Not admin → 401/403. Order missing → 404. Order not unpaid/overdue → 409 (message: "Payment method can only be changed on unpaid orders"). Invalid method → 400. Invoice email failure → the order update still succeeds; the email error is logged and surfaced as a non-fatal warning in the response so the admin knows to resend manually.

## Files touched

New:
- `src/app/api/admin/orders/[id]/change-payment-method/route.ts`

Modified:
- `src/app/admin/orders/[id]/page.tsx` (editable method dropdown + save button + confirm + refresh)

Reused (no change): `src/lib/resend/templates/invoice.ts` (`buildInvoiceEmail`), `src/lib/resend/client.ts` (`sendEmail`).

## Testing

No test framework in the repo → verify with `npx tsc --noEmit` + `npm run build`, then a manual run-through on a test order:
1. Unpaid `ideal` order → switch to `invoice`: `total` increases by €1.99, `invoice_surcharge = 1.99`, `payment_due_date` set ~14 days out, invoice email received, `order_communications` row added.
2. That invoice order → switch back to `ideal`: `total` −€1.99, `invoice_surcharge = 0`, `payment_due_date` cleared, no email.
3. A `paid` order: dropdown is read-only; calling the endpoint directly returns 409.
4. Invalid method value → 400; non-admin caller → 401/403.
5. Locales: invoice resend renders in the order's `language` (de/nl/en).
