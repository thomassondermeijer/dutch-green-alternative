# Admin Manual (Invoice) Order — Design

**Date:** 2026-06-15
**Status:** Approved (pending spec review)

## Problem

Orders can only be created by customer checkout ([/api/checkout/route.ts](../../../src/app/api/checkout/route.ts)). The admin area is view/edit/delete only — there's no way to create an order manually (e.g. a phone order, or a goodwill order). Admins need to create a new order by hand.

## Scope (Option A — invoice manual order, editable pricing)

In scope:
- A "New Order" admin form that creates an order with a product picker, customer details, and editable pricing.
- The order is always created as **`payment_method = "invoice"`** — it reuses the existing invoice email + 14-day due date + the invoice-reminder cron.

Explicitly **out of scope**:
- No online pay-link (CURO) and no "mark as paid" mode (those are Options B/C).
- No coupon-code logic — just a manual discount amount.
- No auto-fulfilment — the admin uses the existing "Send to Acut" button on the order detail page when ready.

## Decisions (from brainstorming)

- **Pricing: editable with auto defaults.** Subtotal is computed from the picked products; shipping auto-fills (free ≥ €65, else €4.95) but is editable; an optional manual discount; the €1.99 invoice fee defaults on with a toggle. Total recomputes live.
- **Don't refactor checkout.** The new endpoint is self-contained (its own order-number generation + customer upsert), reusing only the shared `buildInvoiceEmail` / `sendEmail` templates. Keeps the live payment path untouched; minor duplication is the accepted trade-off.

## Architecture

### New endpoint: `POST /api/admin/orders/create`

File: `src/app/api/admin/orders/create/route.ts`

Request body:
```ts
{
  email: string; firstName: string; lastName: string; phone?: string;
  shipping: { street, houseNumber, postalCode, city, country };
  billing?: { ... } | null;        // null/omitted = same as shipping
  items: { productId: string; quantity: number }[];
  shippingCost: number;            // admin-editable (auto-defaulted client-side)
  discountAmount: number;          // 0 if none
  invoiceFee: boolean;             // €1.99 toggle
  language: "de" | "nl" | "en";
}
```

Logic:
1. **Auth:** `isAdmin()` — same `createServerClient` + `admin_users` check used by the change-payment-method endpoint. 401 otherwise.
2. **Validate:** ≥1 item, email + name present, each item has a valid `productId` and `quantity ≥ 1`. 400 otherwise.
3. **Look up products** by the submitted `productId`s (service-role) to get the authoritative `name` + `price`. Reject if any id is unknown.
4. **Recompute totals server-side** (do not trust client amounts for subtotal):
   - `subtotal = Σ price × quantity` (from looked-up product prices)
   - `invoiceSurcharge = invoiceFee ? 1.99 : 0`
   - `shippingCost`, `discountAmount` taken from the request (validated `≥ 0`)
   - `total = subtotal + shippingCost + invoiceSurcharge − discountAmount`
5. **Upsert customer** by email (insert or update name/phone/language/address) — mirrors checkout's upsert.
6. **Generate order number** `DGA-YYYYMMDD-NNN` (same scheme as checkout: count today's orders + 1).
7. **Insert order:** `payment_method = "invoice"`, `payment_status = "unpaid"`, `status = "pending"`, `payment_due_date = now + 14d`, `invoice_surcharge`, `subtotal`, `shipping_cost`, `discount_amount`, `total`, `shipping_address`, `billing_address` (= shipping if same), `language`, `customer_id`, `customer_email`.
8. **Insert `order_items`** (one per line, with `product_name`, `quantity`, `unit_price`, `total_price`).
9. **Send the invoice email** via `buildInvoiceEmail` + `sendEmail` (localized to `language`), insert an `order_communications` row (`type: "invoice"`), set `invoice_sent_at`. Email failure is non-fatal → returned as a `warning` (order still created).
10. Return `{ success: true, orderId, orderNumber, warning? }`.

### New page: `/admin/orders/new`

File: `src/app/admin/orders/new/page.tsx` (client component, mirrors existing admin form styling).

- **Customer:** email (required), first name, last name, phone.
- **Shipping address:** street, house number, postal code, city, country. **"Billing same as shipping"** toggle; billing fields when unchecked.
- **Products:** a picker over **active products** (fetched client-side from `products` where `is_active`), showing name + price; admin adds line items and sets quantity; remove line. Subtotal computed live from picked items.
- **Pricing (editable):** shipping cost (auto-defaults to free ≥ €65 else €4.95 when items change, but editable), discount amount (optional, default 0), **€1.99 invoice fee** checkbox (default on), and a live **total**.
- **Language** select (de/nl/en), default `de`.
- **Create order** button → `POST /api/admin/orders/create` → on success `router.push("/admin/orders/{orderId}")`; on error/warning, show the message.

### List page button

File: `src/app/admin/orders/page.tsx` — add a **"+ New Order"** button (in the page header) linking to `/admin/orders/new`.

## Inherited behavior (no extra work)

- The new order appears in the admin list and detail pages.
- The **invoice-reminder cron** (pg_cron, daily) chases it at 7/14/21 days past due.
- The admin can **Send to Acut** from the detail page when ready to fulfil.

## Error handling

- Not admin → 401. Validation failure (no items / bad product id / missing fields / negative amounts) → 400 with a clear message. DB insert failure → 500. Invoice-email failure → order still created, returned as a non-fatal `warning` so the admin knows to resend (the detail page's Communication Log shows whether it sent).

## Files

New:
- `src/app/api/admin/orders/create/route.ts`
- `src/app/admin/orders/new/page.tsx`

Modified:
- `src/app/admin/orders/page.tsx` (add "+ New Order" button)

Reused (no change): `src/lib/resend/templates/invoice.ts` (`buildInvoiceEmail`), `src/lib/resend/client.ts` (`sendEmail`).

## Testing

No test framework → verify with `npx tsc --noEmit` + `npm run build`, then manual:
1. Open `/admin/orders` → "+ New Order" → fill customer + address, add 2 products, leave defaults → Create. Order detail opens; totals = subtotal + €4.95 (or free) + €1.99 − discount; invoice email arrives; an "Invoice" entry shows in the Communication Log; `payment_due_date` ~14 days out.
2. Edit shipping to 0 and toggle the invoice fee off → total recomputes correctly and persists.
3. Apply a discount → reflected in total and on the order.
4. Existing-customer email → reuses/updates the customer (no duplicate).
5. A `nl`/`en` language → invoice email renders in that language.
6. Non-admin (logged out) POST to the endpoint → 401.
