# DGA E-Commerce Platform — Architecture Design

## Overview

Replace the current WordPress site (dutchgreenalternative.nl) with a modern, custom-built e-commerce platform for selling CBD/CBG oils to European consumers (primarily Germany & Netherlands, 50+ demographic).

**Phases:**
- **Phase 1** — Full e-commerce platform with transactional emails
- **Phase 2** — Marketing email automation (newsletters, campaigns, segmentation)

**Stack**: Next.js (App Router) + Supabase + Resend + Curo Payments + Acut Fulfilment
**Design**: Warm & Natural — earthy tones, warm greens/golds, approachable for 50+ audience

---

## 1. Product Catalog

~8 products in 2 categories:

| Category | Products |
|---|---|
| **RAW CBD/CBG Oil** | CBD 5.5%, CBD 11%, CBD Gold 35%, Golden Spectrum 35% (CBD+CBG+CBN), CBG 12% |
| **Pure Formula+** | Mind Comfort 8%, Good Night 8%, Body Harmony 8% |

**Data model**: Products stored in Supabase with multilingual fields (DE/NL/EN), pricing in EUR, stock tracking, product images in Supabase Storage.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│              (Netlify — SSR for SEO)                     │
│                                                          │
│  Pages: Home, Shop, Product Detail, Cart, Checkout,      │
│         Account, Blog, About, FAQ, Lab Results,          │
│         Shipping & Returns, Contact                      │
└──────────┬───────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase Backend                       │
│                                                          │
│  ┌──────────┐  ┌───────────┐  ┌─────────────────────┐   │
│  │ Database │  │  Storage   │  │   Edge Functions     │   │
│  │ (Postgres)│  │ (Images)  │  │                     │   │
│  │          │  │           │  │  • order-webhook     │   │
│  │ products │  │ product/  │  │  • send-email        │   │
│  │ orders   │  │ blog/     │  │  • acut-sync         │   │
│  │ customers│  │ lab-certs/│  │  • abandoned-cart     │   │
│  │ cart     │  │           │  │  • curo-callback      │   │
│  │ blog     │  │           │  │  • newsletter         │   │
│  │ emails   │  │           │  │                     │   │
│  └──────────┘  └───────────┘  └─────────────────────┘   │
│                                                          │
│  Auth (optional customer accounts)                       │
└──────────┬──────────────┬───────────────────────────────┘
           │              │
     ┌─────┘              └──────┐
     ▼                           ▼
┌──────────┐              ┌──────────────┐
│   Curo   │              │     Acut     │
│ Payments │              │ Fulfilment   │
│ (RESTful │              │ (Order sync, │
│  API)    │              │  tracking)   │
└──────────┘              └──────────────┘
           │
           ▼
      ┌──────────┐
      │  Resend  │
      │ (Emails) │
      └──────────┘
```

---

## 3. Key Features

### 3.1 Shop & Checkout
- **Product listing** with category filtering (RAW vs. Pure Formula+)
- **Product detail pages** with descriptions, dosage info, lab certificates, reviews
- **Shopping cart** (persisted in localStorage for guests, Supabase for logged-in users)
- **Guest checkout** with optional account creation post-purchase
- **Curo Payments** integration: iDEAL, Bancontact, SOFORT, Giropay, PayPal, Visa/MC
- **Free shipping threshold** at €65
- **Discount/coupon codes** support
- **Multi-language**: DE (default, based on current primary market), NL, EN

### 3.2 Customer Accounts (Optional)
- Sign up / sign in via Supabase Auth (email + password)
- Order history & tracking
- Saved addresses
- Reorder functionality

### 3.3 Email System (Resend — replacing Metorik)
All emails sent via Supabase Edge Functions calling the Resend API:

| Trigger | Email | Timing |
|---|---|---|
| Order placed | Order confirmation | Immediate |
| Shipped via Acut | Shipping notification + tracking | On webhook |
| Cart abandoned | Abandoned cart recovery | 1hr, 24hr |
| Post-purchase | Review request / follow-up | 7 days |
| Inactivity | Win-back campaign | 30/60/90 days |
| Manual/scheduled | Marketing newsletter | On demand |
| Delivery confirmed | Thank you + reorder prompt | On delivery |

Emails are **multi-language** — sent in the customer's detected/selected language.

### 3.4 Content Pages
- **Blog** — SEO-rich educational articles about CBD (managed via Supabase CMS)
- **About Us / Our Story** — brand narrative
- **FAQ** — common questions about CBD, dosage, shipping
- **Lab Results** — downloadable PDF certificates per product batch
- **Shipping & Returns** — policies per country
- **Contact** — form + WhatsApp link + email

### 3.5 Integrations

**Curo Payments flow:**
1. Customer completes checkout → Next.js creates order in Supabase (status: `pending`)
2. Redirect to Curo payment page via RESTful API
3. Curo callback webhook → Edge Function updates order status to `paid`
4. Triggers order confirmation email + Acut fulfilment sync

**Acut Fulfilment flow:**
1. Order paid → Edge Function sends order data to Acut API
2. Acut processes, ships, returns tracking number via webhook/API
3. Edge Function updates order status + sends shipping notification email

---

## 4. Design Direction — Warm & Natural

### Color Palette
- **Primary**: Forest Green (#2D5A3D) — trust, nature, CBD association
- **Secondary**: Warm Gold (#C4A265) — premium quality, "Gold" product line
- **Background**: Warm Off-White (#FAF7F2) — soft, easy on eyes for 50+ audience
- **Accent**: Sage (#8FAE8B) — gentle, calming
- **Text**: Deep Charcoal (#2C2C2C) — high contrast for readability

### Typography
- **Headings**: Outfit or DM Serif Display — warm, trustworthy serif/sans-serif
- **Body**: Inter or Source Sans Pro — highly readable, clean
- **Minimum body size**: 16px (accessibility for older audience)

### UX Principles for 50+ Audience
- Large, clear buttons with high contrast
- Generous whitespace — avoid cluttered layouts
- Simple, linear checkout flow (minimal steps)
- Clear product photography with zoom
- Trust signals prominent: lab-tested badges, customer reviews, secure payment icons
- WhatsApp support button always visible
- No aggressive pop-ups — gentle, well-timed nudges only

---

## 5. Page Structure

```
/                           → Home (hero, featured products, trust signals, blog preview)
/shop                       → All products with category filters
/shop/[slug]                → Product detail page
/cart                       → Shopping cart
/checkout                   → Checkout (guest or logged-in)
/checkout/success           → Order confirmation
/account                    → Dashboard (orders, addresses, reorder)
/account/login              → Login
/account/register           → Register
/blog                       → Blog listing
/blog/[slug]                → Blog article
/about                      → About Us / Our Story
/faq                        → FAQ (accordion style)
/lab-results                → Lab certificates
/shipping-returns           → Shipping & Returns policy
/contact                    → Contact form + WhatsApp
/[locale]/...               → All pages available in DE, NL, EN
```

---

## 6. Database Schema (Key Tables)

- `products` — id, slug, category, price, stock, images, translations (JSONB for DE/NL/EN)
- `orders` — id, customer_email, status, total, shipping_address, language, curo_transaction_id, acut_order_id, tracking_number
- `order_items` — order_id, product_id, quantity, price
- `customers` — id (supabase auth), email, name, addresses, language_pref
- `cart_sessions` — id, customer_id (nullable for guests), items (JSONB), created_at
- `blog_posts` — id, slug, title, content, translations, published_at, tags
- `coupons` — id, code, discount_type, discount_value, valid_from, valid_until, usage_limit
- `email_log` — id, recipient, template, status, sent_at
- `reviews` — id, product_id, customer_email, rating, text, language, approved

---

## 7. Deployment

- **Frontend**: Netlify (existing paid account, Next.js support via @netlify/next adapter, global CDN)
- **Backend**: Supabase (managed Postgres, Auth, Storage, Edge Functions)
- **Emails**: Resend (API-based, custom domain for deliverability)
- **Domain**: dutchgreenalternative.nl (same domain, switch DNS from WordPress host to Netlify)

---

## 8. Migration Plan

1. Export all customer data from WordPress/WooCommerce
2. Import into Supabase `customers` table
3. Migrate product data + images
4. Migrate blog posts
5. Set up Curo Payments on new site (same merchant account)
6. Configure Acut Fulfilment API integration
7. Set up Resend + email templates (transactional only — Phase 1)
8. DNS cutover from WordPress to Netlify

---

## 9. Phase 2 — Marketing Email Automation (Future)

- Newsletter campaign builder (compose + schedule)
- Customer segmentation (by purchase history, language, activity)
- Campaign analytics (open rates, click rates)
- Automated win-back flows based on inactivity triggers
- Managed via Supabase Edge Functions + Resend + a `campaigns` / `segments` table

> This phase will be built after Phase 1 is live and stable.
