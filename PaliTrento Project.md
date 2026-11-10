---
aliases: [PaliTrento, "Tara Palit Ta sa Trento"]
tags: [project, marketplace, municipality, trento, agusan-del-sur, supabase, vite, vanilla-js]
status: active
priority: high
created: 2026-11-10
updated: 2026-11-10
github: https://github.com/username/palitrento
supabase-project: xcbkpknsieawtzyfwrff
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
| **Deploy** | GitHub Pages (`BASE_PATH=/PaliTrento/ npm run build`) |
| **Status** | ✅ Active development — core features complete |

---

## 🎯 Core Features (Completed)

### Public Pages
- [x] **Home** — Hero search, category chips, Bantay Presyo price board, featured stores
- [x] **Explore** — Search + filters (category, barangay, open now, LGU verified)
- [x] **Map** — Full-height Leaflet map + store list + "Show my location"
- [x] **Products** — Product catalog with price-cap pills, filters
- [x] **Business** — Detail page (`business.html?trn=TRN-2024-089`)

### Authentication & Accounts
- [x] **Email OTP registration** (Resend, 6-digit code, 10-min expiry)
- [x] **Email/password login** (Supabase Auth, Confirm email OFF)
- [x] **Account page** — Profile (name, barangay, avatar), My Orders tab
- [x] **Avatar upload** — JPG/PNG/WebP, 2MB max, crop to 256x256, stored in `avatars` bucket
- [x] **Avatar dropdown** — Role-based (Dashboard/My Orders/Account/Settings/Logout), hover desktop / click mobile

### Merchant Features
- [x] **Business owner registration** → Email OTP → Store setup wizard
- [x] **3-step store setup** — Details + GPS pin (Leaflet) + Photos (storefront/permits)
- [x] **Business owner dashboard** — Products CRUD, Orders workflow (Confirm→Ready→Complete), Analytics
- [x] **QR Standee PDF Generator** — A5/A4 PDF with QR code, store branding, customizable content

### Orders & Chat
- [x] **Product detail page** — Reserve for pickup, quantity, payment method
- [x] **Pickup orders** — PENDING → CONFIRMED → READY_FOR_PICKUP → COMPLETED
- [x] **Buyer-Seller chat** (Supabase Realtime, per-order, optimistic UI, read receipts)
- [x] **Unread message badge** — Real-time, cross-page, clears on chat open

### LGU Admin
- [x] **Admin dashboard** — Stats cards, quick actions
- [x] **Verification queue** — Filterable, review modal (Approve/Clarification/Reject)
- [x] **Price broadcasts** — Create/manage advisories
- [x] **Reports** — Category/barangay breakdown, price cap compliance

---

## 🗂️ Project Structure

```text
palitrento2/
├── index.html, explore.html, map.html, products.html, business.html
├── register.html, login.html, account.html, verify.html
├── register-business.html, store-setup.html, dashboard.html, chat.html
├── admin.html, admin-verification.html, admin-prices.html, admin-reports.html
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
│   ├── register-business.js, store-setup.js, dashboard.js, chat.js
│   ├── admin.js, admin-verification.js, admin-prices.js, admin-reports.js
├── supabase/
│   ├── schema.sql              # Core tables + RLS
│   ├── seed.sql                # 4 fake stores + products
│   ├── add-store.sql           # Manual store insert template
│   ├── email-otp.sql           # email_otp_codes table + RLS
│   ├── orders.sql              # Orders table + RLS
│   ├── chat.sql                # Messages table + RLS + Realtime
│   ├── admin.sql               # Advisories + admin RLS
│   ├── admin-notes.sql         # admin_notes, verified_at, verified_by
├── .env                        # Real keys (gitignored)
├── .env.example                # Placeholders only
├── vite.config.js              # Multi-page, target es2022
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
| `products` | `id`, `store_id`, `name`, `category`, `unit`, `current_price`, `lgu_srp_ceiling`, `in_stock`, `quantity`, `created_at` |
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
| **Auth Providers** | Email (ON), Confirm email (OFF) |
| **Site URL** | `http://localhost:5173` |
| **Redirect URLs** | `http://localhost:5173/**` |

### Edge Functions Deployed
| Function | Purpose | Secrets Required |
|----------|---------|------------------|
| `send-email-otp` | Sends 6-digit code via Resend | `RESEND_API_KEY`, `SUPABASE_URL`, `SERVICE_ROLE_KEY` |
| `verify-email-otp` | Verifies code, marks used | `SUPABASE_URL`, `SERVICE_ROLE_KEY` |

### Resend Email
- **Test mode**: Only `kenteyy2@gmail.com` can receive
- **Production**: Verify domain at `resend.com/domains`, update `from:` in `send-email-otp`

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

# Production build (for GitHub Pages)
BASE_PATH=/PaliTrento/ npm run build

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
- [ ] Set up real SMTP for emails (Supabase → Auth → SMTP Settings)
- [ ] Verify Resend domain at `resend.com/domains`
- [ ] Update `from:` address in `send-email-otp` Edge Function
- [ ] Set real Site URL & Redirect URLs in Supabase Auth
- [ ] Configure GitHub Pages: `BASE_PATH=/PaliTrento/ npm run build`, publish `dist/`
- [ ] Add repo secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## 🔗 Key Links

- **Supabase Dashboard:** https://supabase.com/dashboard/project/xcbkpknsieawtzyfwrff
- **Resend Dashboard:** https://resend.com
- **GitHub Repo:** [Add your repo URL]
- **Live Site (GitHub Pages):** [Add your URL]
- **Obsidian Vault:** This file

---

## 📝 Development Log

### Completed Features (Chronological)
1. ✅ Public pages (5 pages) + Supabase schema/seed
2. ✅ Email/password login (fixed URL crash, account page bugs)
3. ✅ Email OTP registration (Resend, 6-digit, 10-min expiry)
4. ✅ Avatar upload + nav icon + dropdown menu
5. ✅ Merchant onboarding (3-step wizard)
6. ✅ Business owner dashboard (Products CRUD, Orders, Analytics)
7. ✅ LGU Admin (Verification, Prices, Reports)
8. ✅ Pickup Orders (Reserve → Confirm → Ready → Complete)
9. ✅ Buyer-Seller Chat (Realtime, optimistic UI, read receipts)
10. ✅ Unread Message Badge (Real-time, cross-page, clears on chat open)
11. ✅ QR Standee PDF Generator (A5/A4, QR code, store branding, customizable)

### Known Issues (Resolved)
1. ❌ Explore showed 8 fake stores → Fixed `.env` vs `.env.example`
2. ❌ Register stuck on "Creating..." → Fixed `new URL()` crash + try/catch/finally
3. ❌ Account page nav wrong / read-only / no barangay → Fixed via Claude Code
4. ❌ Profile save shows error → Removed `email` from profiles select (doesn't exist)
5. ❌ Chat badge not showing → Fixed badge always renders + query fix + realtime listener
6. ❌ QR Standee not generating → Fixed PDF generation with jsPDF + QR code integration

---

## 🎯 Next Up (Priority Order)

1. **Product Images** — Upload product photos to storage
2. **Price Broadcast Push** — Notify users when LGU posts new price caps
3. **SMS OTP** — PhilSMS/Semaphore via Edge Function
4. **Push Notifications** — Browser push for order updates
5. **Offline Field Inspector** — IndexedDB + batch sync for LGU audits

---

## 🏷️ Tags for Obsidian

#project/palitrento #marketplace #municipality #trento #agusan-del-sur #supabase #vite #vanilla-js #realtime #chat #orders #merchant-onboarding #lgu-admin #pwa #mobile-first

---

## 📁 Related Files in Vault

- [[CLAUDE.md]] — Context for Claude Code
- [[HANDOFF_README.md]] — Full handoff documentation
- [[PaliTrento Project.canvas]] — Visual project map (create if needed)

---

> **Last updated:** 2026-11-10
> **Current phase:** QR Standee PDF complete → Next: Product Images
> **To continue in new chat:** Paste `HANDOFF_README.md` and say "Read this and continue from the 'Where we stopped' section."