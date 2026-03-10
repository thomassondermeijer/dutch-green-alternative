# DGA E-Commerce Platform — Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Build a full e-commerce website for DutchGreenAlternative.nl using Next.js + Supabase, replacing WordPress.

**Architecture:** Next.js App Router on Netlify for SSR/SEO, Supabase for database/auth/storage/edge functions, Curo Payments for checkout, Acut Fulfilment for shipping, Resend for emails. Multi-language (DE/NL/EN).

**Tech Stack:** Next.js 15 (App Router), React 19, Supabase (Postgres, Auth, Storage, Edge Functions), Resend, Curo Payments RESTful API, Acut Fulfilment API, TypeScript, CSS Modules

**Design doc:** [2026-03-10-dga-ecommerce-design.md](file:///Users/thoma/stack/DGA%20new/docs/plans/2026-03-10-dga-ecommerce-design.md)

---

## Task 1: Project Scaffolding & Configuration

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json` (via create-next-app)
- Create: `.env.local.example`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`
- Create: `netlify.toml`

**Step 1: Initialize Next.js project**
```bash
npx -y create-next-app@latest ./ --typescript --app --src-dir --no-tailwind --eslint --no-turbopack --import-alias "@/*"
```

**Step 2: Install core dependencies**
```bash
npm install @supabase/supabase-js @supabase/ssr @netlify/next resend
```

**Step 3: Create environment config**
Create `.env.local.example` with all required env vars:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
CURO_MERCHANT_ID=
CURO_API_KEY=
CURO_API_URL=https://gateway.curopayments.net/rest/v1
ACUT_API_URL=
ACUT_API_KEY=
NEXT_PUBLIC_SITE_URL=https://dutchgreenalternative.nl
```

**Step 4: Create Supabase client helpers**
Create `src/lib/supabase/client.ts` (browser client) and `src/lib/supabase/server.ts` (server-side client with cookies).

**Step 5: Create Netlify config**
Create `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

**Step 6: Verify dev server starts**
```bash
npm run dev
```
Expected: Next.js dev server starts on localhost:3000

**Step 7: Commit**
```bash
git init && git add -A && git commit -m "chore: scaffold Next.js project with Supabase + Netlify config"
```

---

## Task 2: Database Schema & Supabase Setup

**Files:**
- Supabase migrations (applied via MCP)

**Step 1: Create products table**
```sql
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('raw', 'pure_formula')),
  price DECIMAL(10,2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  image_urls TEXT[] DEFAULT '{}',
  translations JSONB NOT NULL DEFAULT '{}',
  -- translations: { "de": { "name": "", "description": "", "short_description": "" }, "nl": {...}, "en": {...} }
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Step 2: Create customers table**
```sql
CREATE TABLE customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  language_pref TEXT DEFAULT 'de' CHECK (language_pref IN ('de', 'nl', 'en')),
  addresses JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX idx_customers_email ON customers(email);
```

**Step 3: Create orders & order_items tables**
```sql
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  customer_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  shipping_address JSONB NOT NULL,
  billing_address JSONB,
  language TEXT DEFAULT 'de',
  coupon_code TEXT,
  curo_transaction_id TEXT,
  acut_order_id TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL
);
```

**Step 4: Create cart_sessions table**
```sql
CREATE TABLE cart_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE,
  items JSONB NOT NULL DEFAULT '[]',
  email TEXT,
  abandoned_email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Step 5: Create supporting tables**
```sql
CREATE TABLE coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  translations JSONB NOT NULL DEFAULT '{}',
  -- { "de": { "title": "", "content": "", "excerpt": "", "meta_description": "" }, ... }
  featured_image TEXT,
  tags TEXT[] DEFAULT '{}',
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT,
  language TEXT DEFAULT 'de',
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE email_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient TEXT NOT NULL,
  template TEXT NOT NULL,
  subject TEXT,
  language TEXT DEFAULT 'de',
  status TEXT DEFAULT 'sent',
  resend_id TEXT,
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT now()
);
```

**Step 6: Enable RLS policies**
Apply appropriate RLS policies:
- Products: public read, admin write
- Orders: customer reads own, admin reads all
- Customers: customer reads/updates own
- Reviews: public read approved, authenticated create

**Step 7: Seed product data**
Insert the 8 products with translations (DE/NL/EN), prices, and categories.

**Step 8: Commit migration notes**

---

## Task 3: Internationalization (i18n) Setup

**Files:**
- Create: `src/i18n/config.ts`
- Create: `src/i18n/dictionaries/de.json`, `nl.json`, `en.json`
- Create: `src/i18n/get-dictionary.ts`
- Modify: `src/app/layout.tsx` → `src/app/[locale]/layout.tsx`

**Step 1: Set up locale routing**
Use Next.js App Router `[locale]` dynamic segment pattern. Create middleware for locale detection (accept-language header, cookie-based preference).

**Step 2: Create dictionary files**
Create JSON translation files for DE (default), NL, EN with all UI strings: navigation, buttons, product labels, checkout flow, error messages, footer, etc.

**Step 3: Create dictionary loader**
```typescript
const dictionaries = {
  de: () => import('./dictionaries/de.json').then(m => m.default),
  nl: () => import('./dictionaries/nl.json').then(m => m.default),
  en: () => import('./dictionaries/en.json').then(m => m.default),
};
export const getDictionary = async (locale: string) => dictionaries[locale]();
```

**Step 4: Update layout to use `[locale]` param**
Move `app/layout.tsx` → `app/[locale]/layout.tsx`, add locale to HTML lang attribute, load dictionary.

**Step 5: Verify locale switching works**
Visit `localhost:3000/de`, `/nl`, `/en` — each shows correct language.

**Step 6: Commit**
```bash
git add -A && git commit -m "feat: add i18n with DE/NL/EN locale routing"
```

---

## Task 4: Design System & Global Styles

**Files:**
- Create: `src/app/globals.css` (design tokens + base styles)
- Create: `src/components/ui/Button/Button.tsx`, `Button.module.css`
- Create: `src/components/ui/Container/Container.tsx`
- Create: `src/components/layout/Header/Header.tsx`, `Header.module.css`
- Create: `src/components/layout/Footer/Footer.tsx`, `Footer.module.css`
- Install: Google Fonts (Outfit + Inter via next/font)

**Step 1: Define CSS custom properties (design tokens)**
```css
:root {
  --color-primary: #2D5A3D;        /* Forest Green */
  --color-primary-light: #3A7A52;
  --color-secondary: #C4A265;      /* Warm Gold */
  --color-secondary-light: #D4B87A;
  --color-bg: #FAF7F2;             /* Warm Off-White */
  --color-bg-alt: #F0EBE3;
  --color-accent: #8FAE8B;         /* Sage */
  --color-text: #2C2C2C;           /* Deep Charcoal */
  --color-text-light: #6B6B6B;
  --color-white: #FFFFFF;
  --color-error: #C45B5B;
  --color-success: #4A8B5C;

  --font-heading: 'Outfit', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 24px;
  --font-size-2xl: 32px;
  --font-size-3xl: 48px;

  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
  --transition: 0.2s ease;
}
```

**Step 2: Build reusable UI components**
Button (primary, secondary, ghost variants), Container, Input, Badge, Card.

**Step 3: Build Header**
Logo, navigation (Shop, About, Blog, FAQ, Contact), language switcher, cart icon with badge count, mobile hamburger menu.

**Step 4: Build Footer**
Company info, navigation links, trust badges (lab-tested, secure payment), social links, language selector, copyright.

**Step 5: Apply layout with Header + Footer**
Update `[locale]/layout.tsx` to include Header and Footer wrapping all pages.

**Step 6: Verify visual output**
Run dev server, check all pages have consistent header/footer, colors/fonts match design spec.

**Step 7: Commit**
```bash
git add -A && git commit -m "feat: design system with global styles, header, footer components"
```

---

## Task 5: Home Page

**Files:**
- Create: `src/app/[locale]/page.tsx`
- Create: `src/components/home/Hero/Hero.tsx`, `Hero.module.css`
- Create: `src/components/home/FeaturedProducts/FeaturedProducts.tsx`
- Create: `src/components/home/TrustSignals/TrustSignals.tsx`
- Create: `src/components/home/BlogPreview/BlogPreview.tsx`
- Create: `src/components/shared/ProductCard/ProductCard.tsx`, `ProductCard.module.css`

**Step 1: Build Hero section**
Full-width hero with warm imagery, headline, subheadline, CTA button to shop. Subtle parallax or fade-in animation.

**Step 2: Build ProductCard component**
Reusable card: product image, name, short description, price, "Add to Cart" button. Hover effect with gentle scale.

**Step 3: Build FeaturedProducts section**
Grid of 3-4 featured products using ProductCard. Fetched server-side from Supabase.

**Step 4: Build TrustSignals section**
Three columns: "Best Price", "Lab Tested", "Personal Customer Service" — with icons. Matches current site messaging.

**Step 5: Build BlogPreview section**
Latest 3 blog posts as cards with featured image, title, excerpt.

**Step 6: Assemble Home page**
Combine all sections. Ensure responsive layout (mobile/tablet/desktop).

**Step 7: Commit**
```bash
git add -A && git commit -m "feat: home page with hero, products, trust signals, blog preview"
```

---

## Task 6: Shop & Product Detail Pages

**Files:**
- Create: `src/app/[locale]/shop/page.tsx`
- Create: `src/app/[locale]/shop/[slug]/page.tsx`
- Create: `src/components/shop/ProductGrid/ProductGrid.tsx`
- Create: `src/components/shop/CategoryFilter/CategoryFilter.tsx`
- Create: `src/components/shop/ProductDetail/ProductDetail.tsx`, `ProductDetail.module.css`
- Create: `src/components/shop/ReviewSection/ReviewSection.tsx`
- Create: `src/components/shop/AddToCart/AddToCart.tsx`

**Step 1: Build Shop listing page**
Server-side fetch all active products. Category filter tabs (All / RAW CBD-CBG / Pure Formula+). Responsive product grid.

**Step 2: Build Product Detail page**
Large product image (with zoom on hover), product name, price, description, quantity selector, Add to Cart button, dosage info, ingredients. Tab section: Description / Lab Results / Reviews.

**Step 3: Generate static params for product slugs**
Use `generateStaticParams` for all product slugs × locales for ISR.

**Step 4: Add SEO metadata**
Use `generateMetadata` for proper title, description, Open Graph tags per product.

**Step 5: Verify product pages render correctly**
- `/de/shop` shows all products in German
- `/nl/shop/cbd-raw-11` shows Dutch product detail
- Category filters work

**Step 6: Commit**
```bash
git add -A && git commit -m "feat: shop listing and product detail pages"
```

---

## Task 7: Shopping Cart

**Files:**
- Create: `src/lib/cart/cart-context.tsx`
- Create: `src/lib/cart/cart-actions.ts`
- Create: `src/app/[locale]/cart/page.tsx`
- Create: `src/components/cart/CartDrawer/CartDrawer.tsx`, `CartDrawer.module.css`
- Create: `src/components/cart/CartItem/CartItem.tsx`
- Create: `src/components/cart/CartSummary/CartSummary.tsx`

**Step 1: Create Cart context + provider**
React Context for cart state. Persist to localStorage for guests. Sync to Supabase `cart_sessions` when user is logged in.

**Step 2: Build CartDrawer (slide-out panel)**
Triggered by cart icon in header. Shows items, quantities (editable), remove button, subtotal, "Go to Checkout" CTA.

**Step 3: Build full Cart page**
Table view of cart items, quantity controls, coupon code input, shipping estimate, order total with/without free shipping threshold message.

**Step 4: Implement Add to Cart animation**
Subtle badge count increment + toast notification on add.

**Step 5: Verify cart functionality**
- Add products from shop/detail pages
- Update quantities in cart
- Remove items
- Cart persists on page refresh (localStorage)
- Free shipping message shows/hides at €65 threshold

**Step 6: Commit**
```bash
git add -A && git commit -m "feat: shopping cart with drawer, full page, and persistence"
```

---

## Task 8: Checkout & Curo Payments Integration

**Files:**
- Create: `src/app/[locale]/checkout/page.tsx`
- Create: `src/app/[locale]/checkout/success/page.tsx`
- Create: `src/components/checkout/CheckoutForm/CheckoutForm.tsx`, `CheckoutForm.module.css`
- Create: `src/components/checkout/OrderSummary/OrderSummary.tsx`
- Create: `src/lib/curo/client.ts`
- Create: `src/app/api/checkout/route.ts`
- Create: `src/app/api/curo-webhook/route.ts`

**Step 1: Build Checkout page**
Multi-section form: contact info (email, phone), shipping address, billing address (same as shipping toggle), payment method selection, order review.

**Step 2: Create Curo Payments client**
Server-side helper for Curo RESTful API: create transaction, check status, handle refunds. Uses `CURO_MERCHANT_ID` + `CURO_API_KEY`.

**Step 3: Build checkout API route**
`POST /api/checkout`:
1. Validate cart items + stock
2. Apply coupon if present
3. Create order in Supabase (status: `pending`)
4. Create Curo transaction via API
5. Return Curo redirect URL to client

**Step 4: Build Curo webhook handler**
`POST /api/curo-webhook`:
1. Verify webhook signature
2. Update order status to `paid`
3. Trigger order confirmation email (Resend)
4. Trigger Acut fulfilment sync

**Step 5: Build success page**
Order confirmation with order number, summary, estimated delivery.

**Step 6: Verify checkout flow end-to-end**
Use Curo test environment. Complete a test purchase with iDEAL.

**Step 7: Commit**
```bash
git add -A && git commit -m "feat: checkout flow with Curo Payments integration"
```

---

## Task 9: Acut Fulfilment Integration

**Files:**
- Create: `src/lib/acut/client.ts`
- Create: Supabase Edge Function `supabase/functions/acut-sync/index.ts`
- Create: `src/app/api/acut-webhook/route.ts`

**Step 1: Create Acut API client**
Helper for Acut API: submit order, check status, get tracking. Uses `ACUT_API_KEY`.

**Step 2: Build acut-sync Edge Function**
Triggered after payment confirmed. Sends order data to Acut:
- Customer name + shipping address
- Order items (product names, quantities)
- Order number for reference

**Step 3: Build Acut webhook handler**
`POST /api/acut-webhook`: receives tracking updates from Acut.
- Updates order.tracking_number and order.tracking_url
- Updates order.status to `shipped` / `delivered`
- Triggers shipping notification email

**Step 4: Verify with Acut test API**
Submit a test order and verify it appears in Acut's system.

**Step 5: Commit**
```bash
git add -A && git commit -m "feat: Acut fulfilment integration for order shipping"
```

---

## Task 10: Email System (Resend)

**Files:**
- Create: `src/lib/resend/client.ts`
- Create: `src/lib/resend/templates/order-confirmation.tsx`
- Create: `src/lib/resend/templates/shipping-notification.tsx`
- Create: `src/lib/resend/templates/abandoned-cart.tsx`
- Create: `src/lib/resend/templates/review-request.tsx`
- Create: `src/lib/resend/templates/welcome.tsx`
- Create: Supabase Edge Function `supabase/functions/send-email/index.ts`
- Create: Supabase Edge Function `supabase/functions/abandoned-cart-check/index.ts`

**Step 1: Create Resend client**
Simple wrapper around Resend API with error handling + email logging to `email_log` table.

**Step 2: Build email templates**
Use React Email (JSX templates) for all transactional emails. Multi-language support — template receives locale and renders accordingly. Consistent branding: DGA logo, warm color scheme, clear CTAs.

**Step 3: Build send-email Edge Function**
Generic function that accepts template name, recipient, locale, and data. Routes to correct template and sends via Resend.

**Step 4: Build abandoned-cart-check Edge Function**
Scheduled function (Supabase cron). Finds cart_sessions older than 1 hour with email but no order. Sends abandoned cart email.

**Step 5: Wire up email triggers**
- Order confirmed → order confirmation email
- Shipped → shipping notification
- 7 days post-delivery → review request
- Welcome email on account creation

**Step 6: Test all email templates**
Send test emails for each template, verify rendering in multiple email clients.

**Step 7: Commit**
```bash
git add -A && git commit -m "feat: email system with Resend integration and transactional templates"
```

---

## Task 11: Customer Accounts

**Files:**
- Create: `src/app/[locale]/account/page.tsx`
- Create: `src/app/[locale]/account/login/page.tsx`
- Create: `src/app/[locale]/account/register/page.tsx`
- Create: `src/app/[locale]/account/orders/page.tsx`
- Create: `src/app/[locale]/account/orders/[id]/page.tsx`
- Create: `src/components/account/OrderHistory/OrderHistory.tsx`
- Create: `src/components/account/AddressBook/AddressBook.tsx`
- Create: `src/lib/auth/auth-context.tsx`
- Modify: `src/app/[locale]/layout.tsx` (wrap with auth provider)

**Step 1: Set up Supabase Auth**
Configure email/password auth in Supabase. Create auth context provider for client-side session management.

**Step 2: Build Login & Register pages**
Clean forms with validation. Option to register during checkout (post-purchase account creation).

**Step 3: Build Account dashboard**
Order history list with status badges, tracking links. Address book (add/edit/delete). Language preference selector.

**Step 4: Build Order detail page**
Full order details: items, totals, status timeline, tracking info.

**Step 5: Verify auth flow**
- Register new account
- Login/logout
- View order history
- Guest checkout → optional account creation

**Step 6: Commit**
```bash
git add -A && git commit -m "feat: customer accounts with order history and address book"
```

---

## Task 12: Content Pages

**Files:**
- Create: `src/app/[locale]/about/page.tsx`
- Create: `src/app/[locale]/faq/page.tsx`
- Create: `src/app/[locale]/lab-results/page.tsx`
- Create: `src/app/[locale]/shipping-returns/page.tsx`
- Create: `src/app/[locale]/contact/page.tsx`
- Create: `src/app/[locale]/blog/page.tsx`
- Create: `src/app/[locale]/blog/[slug]/page.tsx`
- Create: `src/components/content/FAQ/FAQ.tsx` (accordion)
- Create: `src/components/content/ContactForm/ContactForm.tsx`
- Create: `src/app/api/contact/route.ts`

**Step 1: Build About page**
Brand story, team/founders section, values (natural, lab-tested, personal service), company photos.

**Step 2: Build FAQ page**
Accordion-style Q&A. Categories: About CBD, Dosage, Shipping, Returns, Payment. Content from translations.

**Step 3: Build Lab Results page**
Grid of products with downloadable PDF certificates. Files stored in Supabase Storage.

**Step 4: Build Shipping & Returns page**
Shipping zones, delivery times, costs, free shipping threshold. Returns policy. Per-language content.

**Step 5: Build Contact page**
Contact form (sends via Resend), WhatsApp link button, email address, business hours.

**Step 6: Build Blog listing + detail pages**
Blog posts from Supabase with tag filtering. SSR for SEO. Rich text rendering.

**Step 7: Add SEO metadata to all content pages**
Proper titles, meta descriptions, Open Graph per page per locale.

**Step 8: Commit**
```bash
git add -A && git commit -m "feat: content pages — about, FAQ, lab results, shipping, contact, blog"
```

---

## Task 13: Coupon System

**Files:**
- Create: `src/lib/coupons/validate.ts`
- Modify: `src/components/cart/CartSummary/CartSummary.tsx` (add coupon input)
- Modify: `src/app/api/checkout/route.ts` (apply coupon to order)
- Create: `src/app/api/coupons/validate/route.ts`

**Step 1: Build coupon validation API**
`POST /api/coupons/validate`: checks code exists, is active, not expired, not over usage limit, meets min order amount. Returns discount info.

**Step 2: Add coupon input to cart**
Input field + "Apply" button in CartSummary. Shows discount amount and new total.

**Step 3: Apply coupon during checkout**
Pass validated coupon through checkout flow. Increment usage_count on successful order.

**Step 4: Verify coupon flow**
- Valid coupon shows discount
- Expired/invalid coupon shows error
- Discount applied correctly to order total

**Step 5: Commit**
```bash
git add -A && git commit -m "feat: coupon/discount code system"
```

---

## Task 14: SEO & Performance Optimization

**Files:**
- Create: `src/app/sitemap.ts`
- Create: `src/app/robots.ts`
- Modify: `src/app/[locale]/layout.tsx` (structured data, meta)
- Create: `src/components/shared/StructuredData/StructuredData.tsx`

**Step 1: Generate sitemap.xml**
Dynamic sitemap including all products, blog posts, and content pages across all locales.

**Step 2: Add robots.txt**
Allow all crawlers, reference sitemap.

**Step 3: Add JSON-LD structured data**
Product schema (price, availability, reviews), Organization schema, BreadcrumbList.

**Step 4: Optimize images**
Use `next/image` with proper sizes, lazy loading, WebP format. Product images optimized on upload.

**Step 5: Add hreflang tags**
For multi-language SEO — each page links to its DE/NL/EN variants.

**Step 6: Lighthouse audit**
Run Lighthouse, target 90+ on Performance, Accessibility, SEO, Best Practices.

**Step 7: Commit**
```bash
git add -A && git commit -m "feat: SEO optimization — sitemap, structured data, hreflang, performance"
```

---

## Task 15: Admin Basics & Product Management

**Files:**
- Create: `src/app/[locale]/admin/page.tsx`
- Create: `src/app/[locale]/admin/products/page.tsx`
- Create: `src/app/[locale]/admin/orders/page.tsx`
- Create: `src/lib/auth/admin-guard.ts`

**Step 1: Create admin route guard**
Check Supabase auth user role. Redirect non-admins.

**Step 2: Build admin dashboard**
Overview: recent orders, revenue summary, low stock alerts.

**Step 3: Build product management**
List/edit products: update prices, stock, translations, toggle active status. Image upload to Supabase Storage.

**Step 4: Build order management**
Order list with status filters. View order details. Manual status updates.

**Step 5: Commit**
```bash
git add -A && git commit -m "feat: basic admin panel for products and orders"
```

---

## Task 16: Data Migration & Go-Live Prep

**Step 1: Export WordPress/WooCommerce data**
Export customers, orders (historical), product details, blog posts.

**Step 2: Write migration scripts**
Node.js scripts to transform WooCommerce data → Supabase schema and import.

**Step 3: Import data to Supabase**
Run migration scripts. Verify data integrity.

**Step 4: Configure Curo Payments for production**
Switch from test to live API credentials. Verify payment methods.

**Step 5: Configure Acut for production**
Point to live Acut API. Verify order submission works.

**Step 6: Set up Resend domain**
Configure dutchgreenalternative.nl in Resend for email deliverability (SPF, DKIM, DMARC).

**Step 7: Deploy to Netlify**
Connect Git repo to Netlify. Set environment variables. Deploy.

**Step 8: DNS cutover**
Point dutchgreenalternative.nl DNS to Netlify. Verify SSL.

**Step 9: Smoke test production**
Full checkout flow on live site. Verify emails, payment, fulfilment.

**Step 10: Commit & tag release**
```bash
git tag v1.0.0 && git push --tags
```

---

## Verification Plan

### Automated Tests
- Unit tests for cart logic, coupon validation, price calculations
- Run: `npm test`

### Integration Tests
- Curo payment flow (test environment)
- Acut order submission (test API)
- Resend email delivery (test mode)

### Manual Verification
1. **Full purchase flow**: Browse → Add to cart → Checkout → Pay (Curo test) → Confirm order → Verify email received
2. **Multi-language**: Switch DE/NL/EN — verify all content translates
3. **Mobile responsive**: Test on iPhone/Android viewport sizes
4. **Guest vs. Account**: Complete checkout as guest, then as logged-in user
5. **Coupon codes**: Apply valid/invalid/expired codes
6. **SEO**: Run Lighthouse on key pages, check Google structured data testing tool
7. **Accessibility**: Keyboard navigation, screen reader basics, color contrast (important for 50+ audience)
