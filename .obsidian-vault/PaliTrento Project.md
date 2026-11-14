---
aliases: [PaliTrento, "Tara Palit Ta sa Trento"]
tags: [project, marketplace, municipality, trento, agusan-del-sur, supabase, vite, vanilla-js]
status: active
priority: high
created: 2026-11-10
updated: 2026-11-14
github: https://github.com/xyranth-the-great/PaliTrento
supabase-project: xcbkpknsieawtzyfwrff
custom-domain: palitrento.online
---

# 🏪 PaliTrento — "Tara, Palit Ta sa Trento!"

> **Local marketplace & directory for the Municipality of Trento, Agusan del Sur, Philippines**
> *Find nearby stores, products, prices, and a map. LGU price-cap transparency & trust badges.*

---

## 📋 Project Overview

| Field | Details |
|-------|---------|
| **Name** | PaliTrento ("Tara, Palit Ta sa Trento!") |
| **Mission** | Make it easy for Trento residents to find, support, and transact with local businesses; give micro-entrepreneurs a zero-friction digital presence |
| **Scope** | Municipality of Trento, Agusan del Sur, Philippines |
| **Stack** | Vite + Vanilla JS (ES modules) + Supabase (Postgres + Auth + Storage + Realtime) |
| **Deploy** | GitHub Pages (custom domain: `palitrento.online`) |
| **Status** | ✅ Active development — core features complete; custom domain configured |

---

## 🎯 Core Features (Completed)

### Public Pages
- [x] **Home** — Hero search, category chips, featured products carousel above the Bantay Presyo price board, featured stores
- [x] **Explore** — Search + filters (category, barangay, open now, Verified); includes active featured products
- [x] **Map** — Full-height Leaflet map + store list + "Show my location"
- [x] **Products** — Product catalog with price-cap pills, filters, and active featured products
- [x] **Business** — Detail page (`business.html?trn=TRN-2024-089`)

### Authentication & Accounts
- [x] **Email OTP registration** (Resend, 6-digit code, 10-min expiry)
- [x] **Email/password login** (Supabase Auth, Confirm email ON)
- [x] **Google OAuth** — new accounts choose Customer or Business owner; business owners continue to store setup
- [x] **Forgot password / Password reset** (Supabase SMTP via Resend)
- [x] **Account page** — Profile (name, barangay, avatar)
- [x] **Avatar upload** — JPG/PNG/WebP, 2MB max, crop to 256x256, stored in `avatars` bucket
- [x] **Avatar dropdown** — Role-based account links, Settings, and Logout; hover desktop / click mobile
- [x] **Settings page** — Profile, Notifications, Privacy, Security, Preferences, Danger Zone (`settings.html`)

### Merchant Features
- [x] **Business owner registration** → Email OTP → Store setup wizard
- [x] **3-step store setup** — Details + GPS pin (Leaflet) + Photos (storefront/permits)
- [x] **Business owner dashboard** — Products CRUD, Orders workflow (Confirm→Ready→Complete), Analytics
- [x] **Product image upload** — Dashboard edit product → upload → stored in `product-images` bucket
- [x] **Featured product ads** — Demo payment and `featured_until` scheduling; active ads appear on Home, Explore, and Products
- [x] **QR Standee PDF** — Generate A5/A4 printable PDF for store signage (via `standee.html`)

### Orders & Chat
- [x] **Product detail page** — Reserve for pickup, quantity, payment method
- [x] **Pickup orders** — PENDING → CONFIRMED → READY_FOR_PICKUP → COMPLETED
- [x] **Buyer-Seller chat** (Supabase Realtime, per-order, optimistic UI, read receipts)
- [x] **Seller-visible customer name** — Participant-checked RPC exposes the buyer's name in seller chat
- [x] **Unread message badge** — Real-time, cross-page, clears on chat open
- [x] **My Orders page** (`orders.html`) — Customer order history; hidden from admin/business-owner navigation
- [x] **My Products navigation** — Business owners open their own dashboard Products tab

### LGU Admin
- [x] **Admin dashboard** — Stats cards, quick actions
- [x] Admin heading and page title say **Admin Dashboard**
- [x] **Verification queue** — Filterable, review modal (Approve/Clarification/Reject)
- [x] **Price broadcasts** — Create/manage advisories
- [x] **Reports** — Category/barangay breakdown, price cap compliance

---

## 🗂️ Project Structure

```text
palitrento2/
├── index.html, explore.html, map.html, products.html, business.html
├── register.html, login.html, account.html, verify.html
├── register-business.html, store-setup.html, dashboard.html, chat.html, orders.html
├── admin.html, admin-verification.html, admin-prices.html, admin-reports.html
├── settings.html, forgot-password.html, reset-password.html
├── css/styles.css              # Design tokens + all components
├── js/
│   ├── supabase.js             # Supabase client (null if no env keys)
│   ├── data.js                 # getStores/getProducts/getStore (seed fallback)
│   ├── seed.js                 # 8 fake stores (dev only)
│   ├── ui.js                   # renderChrome, cards, badge, unread listener
│   ├── auth.js                 # Auth, profile, email OTP, unread listener
│   ├── storage.js              # Supabase Storage upload helpers
│   ├── home.js, explore.js, products.js, business.js, map.js
│   ├── register.js, login.js, account.js, verify.js
│   ├── register-business.js, store-setup.js, dashboard.js, chat.js, orders.js
│   ├── admin.js, admin-verification.js, admin-prices.js, admin-reports.js
│   ├── settings.js, forgot-password.js, reset-password.js
├── supabase/
│   ├── schema.sql              # Core tables + RLS (products include featured_until)
│   ├── seed.sql                # 4 fake stores + products
│   ├── add-store.sql           # Manual store insert template
│   ├── email-otp.sql           # email_otp_codes table + RLS
│   ├── orders.sql              # Orders table + RLS
│   ├── chat.sql                # Messages table + RLS + Realtime
│   ├── admin.sql               # Advisories + admin RLS
│   ├── admin-notes.sql         # admin_notes, verified_at, verified_by
│   ├── product-images.sql      # Product images bucket + RLS
│   ├── product-demo-payments.sql # featured_until column for promoted products
│   ├── chat-customer-name.sql  # Participant-checked buyer-name RPC
│   ├── google-auth-role.sql    # Secure Google sign-up role selection RPC
├── .env                        # Real keys (gitignored)
├── .env.example                # Placeholders only
├── vite.config.js              # Multi-page, target es2022, base: './'
├── CLAUDE.md                   # Context for Claude Code
├── HANDOFF_README.md           # Full handoff documentation
└── package.json
```

---

## 🗄️ Database Schema

### Core Tables

| Table | Key Columns |
|-------|-------------|
| `stores` | `id`, `trn_code`, `business_name`, `trade_category`, `proprietor_name`, `contact_number`, `barangay`, `purok`, `landmark_reference`, `lat`, `lng`, `bmbe_registered`, `dti_registered`, `srp_compliant`, `verification_status`, `open_time`, `close_time`, `accepted_payments`, `storefront_image_url`, `permits_image_url`, `admin_notes`, `verified_at`, `verified_by`, `user_id`, `created_at` |
| `products` | `id`, `store_id`, `name`, `category`, `unit`, `current_price`, `lgu_srp_ceiling`, `in_stock`, `quantity`, `image_url`, `featured_until`, `created_at` |
| `profiles` | `id` (FK auth.users), `full_name`, `role` (customer\|business_owner\|admin), `barangay`, `avatar_url`, `created_at` |
| `orders` | `id`, `buyer_id`, `store_id`, `product_id`, `quantity`, `total_price`, `status`, `payment_method`, `notes`, `confirmed_at`, `ready_at`, `completed_at`, `created_at` |
| `messages` | `id`, `order_id`, `sender_id`, `content`, `read_at`, `created_at` |
| `advisories` | `id`, `title`, `body`, `category`, `barangay`, `priority`, `published_at`, `expires_at`, `created_by`, `created_at` |
| `email_otp_codes` | `id`, `email`, `code`, `purpose`, `expires_at`, `used_at`, `created_at` |

### Key RLS Policies
- **Public read**: Stores (not REJECTED), Products (all), Advisories (active)
- **Owner write**: Stores/Products/Orders/Messages (own store/buyer)
- **Admin**: Full access to all tables

---

## 🔐 Supabase Configuration

| Setting | Value |
|---------|-------|
| **Project URL** | `https://xcbkpknsieawtzyfwrff.supabase.co` |
| **Project Ref** | `xcbkpknsieawtzyfwrff` |
| **Auth Providers** | Email (ON), Confirm email (ON) |
| **Site URL** | `https://palitrento.online` |
| **Redirect URLs** | `https://palitrento.online/**`, `http://localhost:5173/**` |

### SMTP Settings (Resend)
| Setting | Value |
|---------|-------|
| **Host** | `smtp.resend.com` |
| **Port** | `587` |
| **Username** | `resend` |
| **Password** | `re_...` (Resend API key) |
| **Sender email** | `no-reply@palitrento.online` |
| **Sender name** | `PaliTrento` |
| **TLS** | ✅ Enabled |

### Edge Functions Deployed
| Function | Purpose | Secrets Required |
|----------|---------|------------------|
| `send-email-otp` | Sends 6-digit code via Resend | `RESEND_API_KEY`, `SUPABASE_URL`, `SERVICE_ROLE_KEY` |
| `verify-email-otp` | Verifies code, marks used | `SUPABASE_URL`, `SERVICE_ROLE_KEY` |

### Resend Email
- **Domain**: `palitrento.online` ✅ Verified at `resend.com/domains`
- **Production sender**: `PaliTrento <no-reply@palitrento.online>`
- **Edge Function `send-email-otp`**: v6, uses production sender
- **SMTP**: Used by Supabase for email confirmations, password resets, magic links

---

## 🎨 Design System

```css
:root {
  --primary: #1f4d2e;        /* Forest green */
  --primary-dark: #14351f;
  --amber: #e59834;          /* Harvest amber */
  --amber-light: #fef3e2;
  --bg: #fcf9f2;             /* Ivory */
  --card: #fff;
  --muted-bg: #f6f3ec;
  --line: #dcdad3;
  --ink: #1c2a20;
  --muted: #5b675f;
  --ok: #15803d; --ok-bg: #dcfce7;
  --warn: #b45309; --warn-bg: #fef3c7;
  --bad: #b91c1c; --bad-bg: #fee2e2;
  --info: #0369a1; --info-bg: #e0f2fe;
  --font: 'Plus Jakarta Sans';
  --r-sm: 6px; --r-md: 8px; --r-lg: 12px; --r-xl: 16px;
  --pad: 24px;
  --ease: cubic-bezier(.16,1,.3,1);
}
```

**Signature element:** Bantay Presyo price board on home page (today's prices vs LGU price caps)

---

## 🚀 Development Commands

```bash
# Install dependencies
npm install

# Dev server (with hot reload)
npm run dev

# Production build (for GitHub Pages custom domain)
npm run build

# Preview production build
npm run preview
```

**Port:** 5173 (Vite default)

---

## 🚀 Deploy Checklist (Pre-Launch)

- [ ] Delete fake stores: `delete from stores where trn_code in ('TRN-2024-089','TRN-2024-012','TRN-2024-031','TRN-2024-057');`
- [ ] Verify BEKIK status: `update stores set verification_status='PENDING', srp_compliant=false where trn_code='TRN-2026-090';`
- [ ] Add 10-20 real businesses (with owner permission, status PENDING)
- [ ] Verify 16 barangay names in `js/ui.js` against official PSGC list
- [x] Set up SMTP for emails (Supabase → Auth → Configuration → SMTP: `smtp.resend.com:587`, user `resend`)
- [x] Verify Resend domain at `resend.com/domains` (for `palitrento.online`)
- [x] Update `from:` address in `send-email-otp` Edge Function
- [x] Set real Site URL & Redirect URLs in Supabase Auth (`https://palitrento.online`)
- [x] Configure GitHub Pages custom domain: `palitrento.online` + Enforce HTTPS
- [ ] Add repo secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## 🌐 Custom Domain Setup (Completed 2026-11-12)

**Domain:** `palitrento.online` (registered at Z.com)

### DNS Records at Z.com
| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | `@` | `185.199.108.153` | 3600 |
| A | `@` | `185.199.109.153` | 3600 |
| A | `@` | `185.199.110.153` | 3600 |
| A | `@` | `185.199.111.153` | 3600 |
| CNAME | `www` | `xyranth-the-great.github.io.` | 3600 |

### GitHub Pages Settings
- **Source:** GitHub Actions (workflow: `.github/workflows/deploy.yml`)
- **Custom domain:** `palitrento.online`
- **Enforce HTTPS:** ✅ Enabled
- **Build output:** `dist-fix` (matches `vite.config.js` `outDir`)
- **Repo secrets:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` ✅ Added

### Vite Config
```js
// vite.config.js
export default defineConfig({
  base: './',  // for custom domain (no subpath)
  // ...
})
```

### Supabase Auth URLs Updated
- **Site URL:** `https://palitrento.online`
- **Redirect URLs:** `https://palitrento.online/**` (keep `http://localhost:5173/**` for dev)

### Resend Domain (✅ Verified 2026-11-12)
- Added `palitrento.online` at `resend.com/domains`
- DNS records added at Z.com:
  - TXT `resend._domainkey` (DKIM)
  - CNAME `rsend` → `rsend-apne1.forge.rmta.net`
  - CNAME `send` → `send.forge.rmta.net`
  - TXT `_dmarc` → `v=DMARC1; p=none;`
- **Verified in Resend Dashboard**
- Updated `send-email-otp` Edge Function: `from: 'PaliTrento <no-reply@palitrento.online>'`
- Edge Function deployed to Supabase production (version 6)

---

## 🔗 Key Links

- **Supabase Dashboard:** https://supabase.com/dashboard/project/xcbkpknsieawtzyfwrff
- **Resend Dashboard:** https://resend.com
- **GitHub Repo:** https://github.com/xyranth-the-great/PaliTrento
- **Live Site (Custom Domain):** https://palitrento.online
- **Live Site (GitHub Pages fallback):** https://xyranth-the-great.github.io/PaliTrento/
- **Obsidian Vault:** This file

---

## 📝 Development Log

### Completed Features (Chronological)
1. ✅ Public pages (5 pages) + Supabase schema/seed
2. ✅ Email/password login (fixed URL crash, account page bugs)
3. ✅ Email OTP registration (Resend, 6-digit, 10-min expiry)
4. ✅ Avatar upload + nav icon + dropdown menu
5. ✅ Merchant onboarding (3-step wizard)
5. ✅ Business owner dashboard (Products CRUD, Orders, Analytics)
6. ✅ LGU Admin (Verification, Prices, Reports)
7. ✅ Pickup Orders (Reserve → Confirm → Ready → Complete)
8. ✅ Buyer-Seller Chat (Realtime, optimistic UI, read receipts)
9. ✅ Unread Message Badge (Real-time, cross-page, clears on chat open)
10. ✅ **My Orders page** (`orders.html`) — Customer order history; not linked from admin/business-owner navigation
11. ✅ **Account page fix** — Removed Orders tab, now Profile only
12. ✅ **Profile save bug fix** — Removed `email` from profiles select
13. ✅ **Product detail redirect** → `orders.html` after reserve
14. ✅ **Custom domain** `palitrento.online` configured (2026-11-12)
15. ✅ **GitHub Actions automated deployment** with Supabase secrets (2026-11-12)
16. ✅ **Resend domain** `palitrento.online` verified, production sender configured (2026-11-12)
17. ✅ **Product image upload** — Supabase migration run, Dashboard upload working (2026-11-12)
18. ✅ **QR Standee PDF** — A5/A4 printable store signage via `standee.html` (2026-11-12)
19. ✅ **Settings page** — Profile, Notifications, Privacy, Security, Preferences, Danger Zone (`settings.html`, `js/settings.js`) (2026-11-13)
20. ✅ **SMTP + Confirm email** — Supabase SMTP via Resend (`smtp.resend.com:587`), Confirm email ON, password reset enabled (2026-11-13)
21. ✅ **Forgot password / Reset password** — `forgot-password.html` + `reset-password.html` with Supabase `resetPasswordForEmail` and `updateUser` (2026-11-13)
22. ✅ **Featured product promotions** — Demo listing/ad payment, `featured_until`, and featured sections on Home, Explore, and Products; Home carousel scrolls continuously left in a seamless loop and pauses on request (2026-11-13)
23. ✅ **Role-aware navigation** — Business owners see **My Products** linking to `dashboard.html#tab-products`; customers retain **My Orders**; admins/business owners have no `orders.html` navigation link (2026-11-13)
24. ✅ **Google OAuth account type** — New Google sign-ups choose Customer or Business owner; business owners continue to store setup (2026-11-13)
25. ✅ **Seller chat customer name** — Secure participant-checked RPC allows the seller to see the buyer's name in an order chat (2026-11-13)
26. ✅ **Admin title** — Page title and heading now say **Admin Dashboard** (2026-11-13)
27. ✅ **Verification workflow decision** — The 15-day certificate-compliance workflow was undone; optional DTI/BMBE permit upload remains and the public badge says **Verified** (2026-11-13)
28. ✅ **Recent bug fixes** — Store edits preserve existing TRN codes; seller Home navigation no longer loops to the dashboard; account deletion uses a server-side Edge Function (deployment unconfirmed); Email digest was removed from Notifications (2026-11-13)
29. ✅ **Continuous featured carousel** — Replaced six-second one-card steps with a seamless, continuous leftward loop; pauses on hover/focus or when offscreen/hidden, and respects reduced-motion settings (2026-11-14)
30. ✅ **Google OAuth role selection fix** — DB trigger auto-creates profile with default `role='customer'` before user chooses; RPC couldn't update `role` due to column grant only allowing `full_name, barangay`. Created `supabase/fix-google-role-grant.sql`: `grant update (full_name, barangay, role) on profiles to authenticated;` — run in Supabase SQL Editor (2026-11-14)

### In Progress
- Confirm/apply the Google role-selection, customer-name chat, and featured-product Supabase SQL migrations on the connected project.
- Confirm the `delete-account` Edge Function is deployed and test account deletion end to end.
- Production build and headless Chrome checks passed for carousel movement, looping, and Pause behavior. Visually check actual promoted products on desktop and mobile.

### Known Issues (Resolved)
1. ❌ Explore showed 8 fake stores → Fixed `.env` vs `.env.example`
2. ❌ Register stuck on "Creating..." → Fixed `new URL()` crash + try/catch/finally
3. ❌ Account page nav wrong / read-only / no barangay → Fixed via Claude Code
4. ❌ Profile save shows error → Removed `email` from profiles select (doesn't exist)
5. ❌ Chat badge not showing → Fixed badge always renders + query fix + realtime listener
6. ❌ **Dashboard orders 400 error** → Removed `email` from profiles select in dashboard.js
7. ❌ Product detail redirect → Now goes to `orders.html` after reserve (customer flow)
8. ❌ Missing `featured_until` column → Migration exists in `supabase/product-demo-payments.sql`; confirm it has been run on the connected Supabase project.

---

## 🎯 Next Up (Priority Order)

1. **Confirm Supabase setup** — Apply/verify `product-demo-payments.sql`, `google-auth-role.sql`, `chat-customer-name.sql`, and **`fix-google-role-grant.sql`** as needed.
2. **Price Broadcast Push** — Notify users when LGU posts new price caps
3. **SMS OTP** — PhilSMS/Semaphore via Edge Function
4. **Push Notifications** — Browser push for order updates
5. **Offline Field Inspector** — IndexedDB + batch sync for LGU audits

---

## 🏷️ Tags for Obsidian

#project/palitrento #marketplace #municipality #trento #agusan-del-sur #supabase #vite #vanilla-js #realtime #chat #orders #merchant-onboarding #lgu-admin #pwa #mobile-first #custom-domain

---

## 📁 Related Files in Vault

- [[CLAUDE.md]] — Context for Claude Code
- [[HANDOFF_README.md]] — Full handoff documentation
- [[PaliTrento Project.canvas]] — Visual project map (create if needed)

---

> **Last updated:** 2026-11-14
> **Current phase:** Confirm the four Supabase migrations (`product-demo-payments.sql`, `google-auth-role.sql`, `chat-customer-name.sql`, `fix-google-role-grant.sql`) and `delete-account` Edge Function deployment; visually check the featured carousel with actual products on desktop/mobile. Then continue with Price Broadcast Push → SMS OTP → Push Notifications → Offline Field Inspector.
> **To continue in new chat:** Paste `HANDOFF_README.md` and say "Read this and continue from the current-state and pending-check sections."