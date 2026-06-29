# Customer Picker on the New Order Form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a customer search/typeahead to the admin New Order form that prefills the customer + shipping fields from an existing customer.

**Architecture:** A new admin-auth'd `GET /api/admin/customers/search` (service-role, ilike on email/name, limit 10) returns matches; the New Order form gets a debounced search box + results list that prefills the editable fields. The create endpoint is unchanged (it already upserts by email).

**Tech Stack:** Next.js App Router route handler, `@supabase/supabase-js` (service role) + `@supabase/ssr` (admin check), React client component.

**Verification note:** No test framework (only `next build` + `eslint`). Each task verifies with `npx tsc --noEmit` (+ `npm run build` at the end); real validation is the manual run-through in Task 3.

**Data facts:** `customers` columns — `email`, `first_name`, `last_name`, `phone`, `language_pref`, `addresses` (jsonb **array** of `{ street, house_number, postal_code, city, country, first_name, last_name }`). 705 rows; PII (server-side search only).

---

### Task 1: Create the customer-search endpoint

**Files:**
- Create: `src/app/api/admin/customers/search/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/admin/customers/search/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

type AddrRow = { street?: string; house_number?: string; postal_code?: string; city?: string; country?: string };

export async function GET(req: NextRequest) {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const raw = (req.nextUrl.searchParams.get("q") || "").trim();
    if (raw.length < 2) {
        return NextResponse.json({ results: [] });
    }
    // Strip characters that would break the PostgREST .or() filter or inject wildcards.
    const q = raw.replace(/[%,()*]/g, " ").trim();
    if (q.length < 2) {
        return NextResponse.json({ results: [] });
    }
    const pattern = `%${q}%`;

    const { data, error } = await supabaseAdmin
        .from("customers")
        .select("email, first_name, last_name, phone, language_pref, addresses")
        .or(`email.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`)
        .order("created_at", { ascending: false })
        .limit(10);

    if (error) {
        console.error("[Customer Search] query error:", error);
        return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    const results = (data || []).map((c) => {
        const addrs = Array.isArray(c.addresses) ? (c.addresses as AddrRow[]) : [];
        const a = addrs.length > 0 ? addrs[0] : null;
        const language = ["de", "nl", "en"].includes(c.language_pref) ? c.language_pref : "de";
        return {
            email: c.email,
            firstName: c.first_name || "",
            lastName: c.last_name || "",
            phone: c.phone || "",
            language,
            address: a
                ? {
                    street: a.street || "",
                    houseNumber: a.house_number || "",
                    postalCode: a.postal_code || "",
                    city: a.city || "",
                    country: a.country || "DE",
                }
                : null,
        };
    });

    return NextResponse.json({ results });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/customers/search/route.ts"
git commit -m "feat(admin): add customer search endpoint

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add the customer picker to the New Order form

**Files:**
- Modify: `src/app/admin/orders/new/page.tsx`

- [ ] **Step 1: Add the `CustomerResult` type**

Find:
```tsx
type Product = { id: string; price: number; name: string };
type LineItem = { productId: string; quantity: number };
type Addr = { street: string; houseNumber: string; postalCode: string; city: string; country: string };
```
Replace with:
```tsx
type Product = { id: string; price: number; name: string };
type LineItem = { productId: string; quantity: number };
type Addr = { street: string; houseNumber: string; postalCode: string; city: string; country: string };
type CustomerResult = { email: string; firstName: string; lastName: string; phone: string; language: "de" | "nl" | "en"; address: Addr | null };
```

- [ ] **Step 2: Add picker state**

Find:
```tsx
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
```
Replace with:
```tsx
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const [customerQuery, setCustomerQuery] = useState("");
    const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
```

- [ ] **Step 3: Add the debounced search effect + applyCustomer handler**

Find:
```tsx
    const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
```
Replace with:
```tsx
    useEffect(() => {
        const q = customerQuery.trim();
        if (q.length < 2) { setCustomerResults([]); return; }
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(q)}`);
                const data = await res.json();
                setCustomerResults(res.ok && Array.isArray(data.results) ? (data.results as CustomerResult[]) : []);
            } catch {
                setCustomerResults([]);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [customerQuery]);

    const applyCustomer = (c: CustomerResult) => {
        setEmail(c.email);
        setFirstName(c.firstName);
        setLastName(c.lastName);
        setPhone(c.phone);
        setLanguage(c.language);
        if (c.address) setShipping({ ...c.address });
        setCustomerQuery("");
        setCustomerResults([]);
    };

    const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
```

- [ ] **Step 4: Add the search box UI at the top of the Customer card**

Find:
```tsx
                    <h3 className={styles.formSectionTitle} style={{ marginTop: 0 }}>Customer</h3>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Email *</label>
```
Replace with:
```tsx
                    <h3 className={styles.formSectionTitle} style={{ marginTop: 0 }}>Customer</h3>
                    <div className={styles.formGroup} style={{ position: "relative", marginBottom: "1rem" }}>
                        <label className={styles.formLabel}>Find existing customer</label>
                        <input
                            className={styles.formInput}
                            value={customerQuery}
                            onChange={(e) => setCustomerQuery(e.target.value)}
                            placeholder="Search by email or name…"
                            autoComplete="off"
                        />
                        {customerResults.length > 0 && (
                            <div style={{ position: "absolute", zIndex: 10, top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", marginTop: "4px", maxHeight: "260px", overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                                {customerResults.map((c) => (
                                    <button
                                        key={c.email}
                                        type="button"
                                        onClick={() => applyCustomer(c)}
                                        style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid #f3f4f6", cursor: "pointer", fontSize: "0.875rem" }}
                                    >
                                        <strong>{c.email}</strong>{(c.firstName || c.lastName) ? ` — ${c.firstName} ${c.lastName}`.trimEnd() : ""}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Email *</label>
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npm run lint`
Expected: no NEW errors (≈60 pre-existing problems are fine).

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/orders/new/page.tsx"
git commit -m "feat(admin): customer picker prefills the New Order form

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Build + manual verification

**Files:** none (build + manual)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds; `/api/admin/customers/search` appears in the output.

- [ ] **Step 2: Push and deploy**

```bash
git push origin main
```
Wait for the Netlify production deploy to go green.

- [ ] **Step 3: Manual test — prefill** (admin on `dutchgreenalternative.nl`)

1. `/admin/orders` → "+ New Order".
2. In "Find existing customer", type ≥2 chars of a known customer's email or name.
Expected: a results dropdown appears; clicking a result fills email, first/last name, phone, language, and the shipping address — and every field stays editable.

- [ ] **Step 4: Manual test — reuse, new, guards**

1. With a picked customer, add a product and Create → the order reuses that customer (no duplicate customer row; check the order detail page / DB).
2. Clear the picker (or never use it), type a brand-new email + details → Create → a new customer is created as before.
3. Type only 1 char → no request fires (network tab shows none). Logged out, `GET /api/admin/customers/search?q=test` → 401.

---

## Self-Review

**Spec coverage:**
- `GET /api/admin/customers/search` with admin-auth, ilike email/name, limit 10, mapped result incl. first address → Task 1 ✓
- `q` < 2 chars → `{results: []}`; DB error → 500; non-admin → 401 → Task 1 ✓
- Form debounced typeahead + results list + `applyCustomer` prefill (editable) → Task 2 ✓
- Create endpoint unchanged (upsert by email handles picked-or-new) → no task touches it ✓
- Manual test incl. reuse/new/guards → Task 3 ✓

**Placeholder scan:** No TBD/TODO; every step has complete code/commands.

**Type consistency:** `CustomerResult` (Task 2 step 1) is used by the search effect, `applyCustomer`, and the results map (steps 3–4); its `address: Addr | null` matches the endpoint's mapped shape (Task 1) and the form's `setShipping(Addr)`. `language: "de"|"nl"|"en"` matches `setLanguage`'s type. The endpoint path `/api/admin/customers/search` is identical in the route file and the form fetch. The endpoint's returned keys (`email/firstName/lastName/phone/language/address{street,houseNumber,postalCode,city,country}`) match `CustomerResult` exactly.
