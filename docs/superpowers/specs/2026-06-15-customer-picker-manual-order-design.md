# Customer Picker on the New Order Form — Design

**Date:** 2026-06-15
**Status:** Approved (pending spec review)

## Problem

The admin "New Order" form ([/admin/orders/new](../../../src/app/admin/orders/new/page.tsx)) only takes free-text customer fields. The admin wants to **select an existing customer** (there are 705) to prefill the order instead of retyping everything.

## Scope

In scope: a customer search/typeahead on the New Order form that prefills the customer + shipping-address fields from an existing customer, via a small admin-auth'd server endpoint.

Out of scope: any standalone customer-management UI; editing the customer record beyond what the create endpoint already does (it upserts the customer's name/phone/address on order submit); changing the create endpoint at all.

## Why a server endpoint (not a client query)

`customers` is PII behind RLS, and there are 705 rows — too many to load wholesale into the browser, and not safely readable through the anon/browser client. So the search runs through an **admin-auth'd, service-role endpoint**. Debounced typeahead, not a full dropdown.

## Architecture

### New endpoint: `GET /api/admin/customers/search?q=<term>`

File: `src/app/api/admin/customers/search/route.ts`

- **Auth:** `isAdmin()` — same `createServerClient` + `admin_users` check used by the other admin endpoints. 401 otherwise.
- Read `q` from the query string. If `q` is missing or shorter than 2 chars (trimmed) → return `{ results: [] }` (no query).
- Query `customers` (service-role) where any of `email`, `first_name`, `last_name` matches `ilike %q%`, ordered by `created_at` desc, `limit 10`. Select `email, first_name, last_name, phone, language_pref, addresses`.
- Map each row to:
  ```ts
  {
    email, firstName: first_name, lastName: last_name, phone: phone ?? "",
    language: ["de","nl","en"].includes(language_pref) ? language_pref : "de",
    address: firstAddr
      ? { street, houseNumber: house_number ?? "", postalCode: postal_code ?? "",
          city, country: country ?? "DE" }
      : null,   // firstAddr = addresses[0] when addresses is a non-empty array, else null
  }
  ```
  (`customers.addresses` is a jsonb **array** of `{ street, house_number, postal_code, city, country, first_name, last_name }`.)
- Return `{ results: [...] }`. DB error → 500.

### Form enhancement: `src/app/admin/orders/new/page.tsx`

Add a **"Find existing customer"** search box at the top of the Customer card:
- Local state: `customerQuery` (string), `customerResults` (array), and a debounce.
- On input change, debounce ~300 ms; when the trimmed query is ≥2 chars, `fetch('/api/admin/customers/search?q=' + encodeURIComponent(q))` and set `customerResults`; when <2 chars, clear results.
- Render the results as a small list under the input (each row: `email — First Last`). Clicking a result calls an `applyCustomer(r)` handler that sets: `email`, `firstName`, `lastName`, `phone`, `language`, and — if `r.address` is present — the `shipping` address fields. Then clears the query/results.
- All fields remain editable after prefill (the picker only sets initial values).
- If the admin picks nothing and types a fresh email, behavior is unchanged (the create endpoint upserts by email → new customer).
- Fetch errors are non-fatal: on error, just show no results (optionally `console.error`).

## Data flow

```
Admin types in "Find existing customer" (≥2 chars, debounced)
  → GET /api/admin/customers/search?q=… (admin-auth, service-role)
  → up to 10 matches { email, firstName, lastName, phone, language, address }
  → admin clicks one → applyCustomer() prefills customer + shipping fields (editable)
  → Create Order (unchanged endpoint upserts by email → same customer, no duplicate)
```

## Error handling

- Endpoint: non-admin → 401; `q` < 2 chars → `{ results: [] }`; DB error → 500.
- Form: search failures are swallowed (no results shown); they never block manual entry. The create flow is unchanged.

## Files

New:
- `src/app/api/admin/customers/search/route.ts`

Modified:
- `src/app/admin/orders/new/page.tsx` (search box + results + `applyCustomer`)

## Testing

No test framework → `npx tsc --noEmit` + `npm run build`, then manual:
1. Type part of an existing customer's email/name → matches appear; click one → email, name, phone, language, and shipping address prefill, and stay editable.
2. Create the order with a picked customer → the order reuses that customer (no duplicate row).
3. Type a brand-new email (no pick) → still creates a new customer as before.
4. Search `<2` chars → no query fired; non-admin GET to the endpoint → 401.
