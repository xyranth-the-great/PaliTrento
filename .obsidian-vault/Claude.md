PaliTrento: Project Context for Claude Code

Tagline: Tara, Palit Ta sa Trento! ("Come, let's shop in Trento!") Save this file as CLAUDE.md in the project root so Claude Code reads it automatically. Written 2026-11-10, after a planning + first-build conversation. Updated 2026-11-12.

**Custom Domain:** `palitrento.online` (configured 2026-11-12)

1. What this project is

PaliTrento is a hyperlocal discovery platform for the Municipality of Trento, Agusan del Sur, Philippines: a directory and marketplace of local businesses (sari-sari stores, carinderias, market stalls, pharmacies, agri suppliers, services), with products, prices, a map, and LGU (local government) price-cap transparency.

It is a municipality-specific platform, not a generic national one. Filipino/Visayan UX touches, peso pricing, barangay awareness, and trust signals (LGU verified, DTI/BMBE registered, price-cap compliance) are core.

Mission: make it easy for Trento residents to find, support, and transact with local businesses, and give micro-entrepreneurs a zero-friction digital presence.

2. Two source specs, and how conflicts were resolved

The user supplied two documents that described somewhat different projects under the same name.

Doc 1 ("Concept & Specification"): vanilla HTML/CSS/JS + Vite + Supabase; about 15 pages; email/password auth; Leaflet map; GitHub Pages deploy.
Doc 2 ("Developer & Technical Implementation Spec"): a larger civic platform with 33 screens: SMS OTP login, SRP (price cap) compliance, BMBE/DTI verification, LGU admin tools, offline field-inspector audits, QR standees. It suggested React/Next/NestJS/PostGIS.

The user's decisions (authoritative):

Topic	Decision
Stack	Doc 1: Vite + vanilla JS (ES modules), no framework
Colors / visual style	Doc 2 palette
Features	Doc 2 features (price caps, verification badges, barangay filter, open-now)
Login	Doc 2: SMS OTP (not built yet, see section 8)
Backend	Supabase (Postgres + Auth), accessed from JS with @supabase/supabase-js
First pass scope	Public pages only: home, explore, map, products, business

Doc 1's statement that "the marketing surface must not be cream" was overridden by the user choosing Doc 2's ivory palette.

3. Tech stack

Layer	Choice
Build	Vite 5, multi-page (vite.config.js lists pages), target: es2022 (needed for top-level await)
Language	Vanilla JS ES modules, no framework
Data/Auth	Supabase (@supabase/supabase-js), keys via VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
Map	Leaflet 1.9 + OpenStreetMap tiles (installed via npm, circleMarker pins so no icon images are needed)
Fonts	Plus Jakarta Sans (Google Fonts)
Deploy	GitHub Pages: Custom domain `palitrento.online`, `npm run build` (base: './'), publish to gh-pages branch

Note: Vite is only a build/dev tool. Supabase works in any JS; Vite just injects the .env values.

4. Design system (from Doc 2), in css/styles.css as :root tokens
--primary:#1f4d2e  --primary-dark:#14351f   (forest green, civic trust)
--amber:#e59834    --amber-light:#fef3e2    (harvest amber, CTAs and highlights)
--bg:#fcf9f2  --card:#fff  --muted-bg:#f6f3ec  --line:#dcdad3
--ok:#15803d/#dcfce7  --warn:#b45309/#fef3c7  --bad:#b91c1c/#fee2e2  --info:#0284c7/#e0f2fe
--font: 'Plus Jakarta Sans'   radii 6/8/12/16

Rules followed: WCAG AA contrast (amber is used as a background with dark-green text, never as text on white); visible focus rings (amber, 3px); no bounce easing (cubic-bezier(.16,1,.3,1)); prefers-reduced-motion keeps color/opacity transitions; container padding 24px; mobile-first responsive.

Signature element: the Bantay Presyo price board on the home page. It lists staples with today's price vs the LGU price cap and a "Within cap" / "Over cap by ₱X" pill.

Copy style: plain, active, sentence case. Light Filipino touches ("Tara, Palit Ta sa Trento!", "Bantay Presyo"). Errors say what happened and how to fix it.

5. What is built (first pass + subsequent features)
palitrento/
├── index.html      Home: hero search, category chips, Bantay Presyo board, featured stores
├── explore.html    Search + filters (category, barangay, open now, LGU verified)
├── map.html        Full-height Leaflet map + store list + "Show my location"
├── products.html   Product catalog with price-cap pills; filters
├── business.html   Detail page, loaded as business.html?trn=TRN-2024-089
├── register.html   Email/password registration with email OTP (Resend)
├── login.html      Email/password login
├── account.html    Profile (name, barangay, avatar) — no Orders tab
├── verify.html     6-digit email OTP verification
├── orders.html     My Orders page (order history)
├── register-business.html  Business owner registration
├── store-setup.html  3-step store setup (details, GPS pin, photos)
├── dashboard.html  Business owner dashboard (Products CRUD, Orders, Analytics)
├── chat.html       Buyer-seller chat per order (Supabase Realtime)
├── admin.html      Admin dashboard (stats, quick actions)
├── admin-verification.html  Store verification queue
├── admin-prices.html      Price broadcasts
├── admin-reports.html     Category/barangay breakdown, price cap compliance
├── css/styles.css  Tokens + all components (single file)
├── js/
│   ├── supabase.js Creates client; exports null if keys are missing/placeholder
│   ├── data.js     getStores/getProducts/getStore. Falls back to seed data if no Supabase or on error
│   ├── seed.js     8 sample stores + 12 sample products (placeholder data)
│   ├── ui.js       Shared: renderChrome() header/footer, storeCard, productCard, badges, srp(), isOpen(), peso(), CATS, UNITS, PAY, BARANGAYS
│   ├── auth.js     Auth, profile, email OTP, unread listener, avatar upload/delete
│   ├── storage.js  Supabase Storage upload helpers (store images, product images, avatars)
│   ├── home.js  explore.js  products.js  business.js  map.js
│   ├── register.js  login.js  account.js  verify.js
│   ├── register-business.js  store-setup.js  dashboard.js  chat.js  orders.js
│   ├── admin.js  admin-verification.js  admin-prices.js  admin-reports.js
├── supabase/
│   ├── schema.sql   Tables + indexes + RLS (public read-only, owner write, admin all)
│   ├── seed.sql     4 sample stores + 6 products
│   ├── add-store.sql     Manual store insert template
│   ├── email-otp.sql     email_otp_codes table + RLS
│   ├── orders.sql     Orders table + RLS
│   ├── chat.sql     Messages table + RLS + Realtime
│   ├── admin.sql     Advisories + admin RLS
│   ├── admin-notes.sql   admin_notes, verified_at, verified_by
│   ├── product-images.sql  Product images bucket + RLS (NEW)
├── vite.config.js  .env.example  package.json  README.md  .gitignore

How it works

Each page HTML has <div id="chrome-top"> (and #chrome-foot); renderChrome(activePage) injects the header/nav/footer.
data.js queries Supabase; if the client is null or the table is empty, it returns seed data, so the site always renders.
Store → products link: products.store_id === stores.id. In seed data ids are s1..s8; in Supabase they are UUIDs.
Open/closed is computed client-side from open_time / close_time and the visitor's local clock.
All user/DB strings go through esc() before innerHTML.

Verified: npm install && npm run build succeeds. Not yet verified in a browser; run npm run dev and click through every page.

6. Data model (implemented in supabase/schema.sql)

stores: id uuid pk, trn_code text unique (TRN-YYYY-NNN), business_name, trade_category (SARI_SARI|CARINDERIA|FRESH_PRODUCE|PHARMACY|SERVICES|AGRI), proprietor_name, contact_number (E.164), barangay, purok, landmark_reference, lat, lng, bmbe_registered, dti_registered, srp_compliant, verification_status (PENDING|VERIFIED|REJECTED|CLARIFICATION_REQUIRED), open_time, close_time, accepted_payments text[] (CASH|GCASH|TRIKE_COD), storefront_image_url, permits_image_url, admin_notes, verified_at, verified_by, user_id fk→auth.users, created_at

products: id uuid pk, store_id fk→stores, name, category, unit (KG|PC|POUCH|BOTTLE|SACK_25KG|TIE), current_price numeric, lgu_srp_ceiling numeric (null = no cap), in_stock, quantity, image_url, created_at

profiles: id uuid pk (= auth.users.id), full_name, role (customer|business_owner|admin), barangay, avatar_url, created_at

orders: id uuid pk, buyer_id fk→auth.users, store_id fk→stores, product_id fk→products, quantity int, total_price numeric, status (PENDING|CONFIRMED|READY_FOR_PICKUP|COMPLETED|CANCELLED), payment_method (CASH|GCASH|TRIKE_COD), notes, confirmed_at, ready_at, completed_at, created_at

messages: id uuid pk, order_id fk→orders, sender_id fk→auth.users, content text, read_at timestamptz, created_at

advisories: id uuid pk, title, body, category (PRICE_CAP|ANNOUNCEMENT|EMERGENCY|GENERAL), barangay, priority (low|normal|high|critical), published_at, expires_at, created_by fk→auth.users, created_at

email_otp_codes: id uuid pk, email, code, purpose, expires_at, used_at, created_at

RLS policies:
- Public read: stores (not REJECTED), products (all), advisories (active)
- Owner write: stores/products/orders/messages (own store/buyer)
- Admin: all tables full access

Planned tables (from the specs, not yet created): inspections (offline field audit records)

Fields in Doc 2 not yet in the schema: compliance.dti_cert_no, brgy_clearance_no, verified_at, verified_by_officer_id, standee_kit (qr_payload_url, pdf_cmyk_url), remaining_stock_qty, low_stock_threshold, cook_batch_time, purok_broadcast_active, srp_variance_percentage, image_url (now added to products).

7. Full Doc 2 screen map (the long-term roadmap, 33 screens)

Entry: 1 Welcome, 2 Login/Sign up (SMS OTP), 3 Choose Barangay
Buyer: 4 Home Directory, 5 All Categories, 6 Active Search, 7 Search Results, 8 Filters sheet, 9 Map, 10 Business Profile, 11 Product Detail (weight pre-inquiry calc, SRP tag), 12 Directions (landmark steps, tricycle fare), 13 Chat with Seller, 14 Messages Inbox, 15 Profile & Settings
Merchant: 16-18 MSME Onboarding (3 steps: info + GPS pin, photos/permits, review), 19 Dashboard, 20 Add/Edit Product (live SRP check), 21 Catalog (stock toggles, batch price edit), 22 Seller Chat & Orders, 23 Store QR Signage (A5/A4 standee PDF), 24 Daily Sales Logbook, 25 Revenue Analytics
LGU/Admin: 26 Dashboard, 27 Single Application Review, 28 Standee modal, 29 Price Broadcast Composer (SMS/push), 30 Settings (ordinances, fees), 31 Reports/Economic Observatory, 32 Verification Queue, 33 Field Inspector Audit (offline SQLite/IndexedDB, thermal slip print, scale seal test)

Doc 2 API ideas: /api/v1/barangays, /directory/search, /stores/:trn, /price-watch/current, merchant inventory PATCH, pickup orders, standee PDF, /inspections/batch-sync (idempotent UUID keys), /advisories/broadcast. With Supabase these map to tables, RPCs, RLS, and Edge Functions rather than a separate Node server.

Doc 1's UX principles: local-first language, trust signals, browse without login (auth only for transactions), resilient on slow connections, accessible by default, no framework bloat.

Doc 1's original roadmap: seed 10-20 merchants, wire explore to Supabase, product detail + cart, order flow, business onboarding, realtime chat (Supabase Realtime), push notifications, barangay scoping, offline caching, loyalty stamp cards, "bagsakan" group buying, LGU integrations, Cebuano/Tagalog/English toggle.

8. Known gaps, risks, and open decisions

SMS OTP login is not built. Supabase phone auth natively supports Twilio, MessageBird, Vonage, Textlocal. For a Philippine gateway (Semaphore / Movider / PhilSMS) you must use an Auth "Send SMS" hook (Edge Function). The user has not yet chosen an SMS provider. Ask before building auth.
Barangay list in js/ui.js was written from memory (16 names). Verify against the official PSGC list for Trento.
Sample data is fictional. Replace seed.js and seed.sql with real merchants.
No images yet. Doc 2 referenced 3 image assets as unresolved placeholders ({{DATA:IMAGE:...}}): hero market illustration, sari-sari storefront photo, banana basket photo.
Supabase keys not yet connected; pages currently run on seed data.
business.html links use trn_code in the query string (?trn=), not a pretty path.
Accessibility and the old "Impeccable detector" quality gate from Doc 1 have not been run.
Doc 1 used base path /PaliTrento/ for GitHub Pages; this build uses `base: './'` in vite.config.js for custom domain `palitrento.online`.
Product images bucket needs migration before upload works.
Custom domain configured: DNS at Z.com (4 A records + 1 CNAME), GitHub Pages custom domain enabled with Enforce HTTPS, Supabase Auth URLs updated.

9. Suggested next steps (in order)

Run npm install && npm run dev; browser-test all pages (desktop + mobile width).
Run the product-images Supabase migration (see HANDOFF_README.md).
Test product image upload: Dashboard → Edit product → Upload image → Save.
Create the Supabase project, run schema.sql then seed.sql, fill .env, confirm pages show DB data.
Decide the SMS provider, then build login: OTP screen, barangay onboarding, profiles table + trigger, role-based nav.
Merchant flow: onboarding (screens 16-18), dashboard (19), product add/edit with live cap check (20-21). Needs owner RLS policies.
Product detail page + reserve-for-pickup orders; buyer ↔ seller chat via Supabase Realtime.
Admin/LGU: verification queue, price broadcast composer, reports.
Offline field-inspector tool (IndexedDB queue + idempotent batch sync), QR standee PDFs.

10. Working conventions for Claude Code

Keep it framework-free vanilla JS; add dependencies only when clearly needed.
Change design values in the :root tokens in css/styles.css first, then components.
Reuse ui.js helpers; escape all dynamic strings with esc().
Always keep the seed-data fallback working so the site renders without Supabase.
Prices use peso() (₱). Categories/units/payments come from CATS/UNITS/PAY in ui.js. Don't duplicate labels.
Use plain, user-facing wording ("Within cap", "LGU verified"), not system terms.
Never commit .env. The anon key is public-safe only because RLS restricts access, so every new table needs RLS policies.
Test: npm run build must pass; check keyboard focus and mobile layout after UI changes.

11. Conversation log (condensed)

User asked Claude to read a project carefully and analyze before building, then pasted both specs and said ask questions first.
Claude flagged that the two docs conflict (stack, colors, login, scope) and asked which spec is the source of truth, what to deliver first, and how data/login should work.
User answered: deliver public pages only; data via Supabase; asked to clarify the source-of-truth question.
User asked what Vite is and whether Supabase works alone with JS. Claude explained: Supabase is the backend, Vite is only a build tool; both approaches work.
User decided: Vite, Doc 1 stack, Doc 2 colors, Doc 2 features, Doc 2 login (SMS OTP).
Claude built the five public pages, the Supabase schema/seed, and a README; fixed two build issues (template argument order, es2022 target for top-level await); the production build passes; delivered palitrento.zip.
User requested this handoff document for Claude Code.
Subsequent sessions: built email OTP auth, avatar upload, merchant onboarding, dashboard, admin, orders, chat, unread badge, orders page, account page fixes, product image upload frontend.
2026-11-12: Purchased `palitrento.online` domain, configured DNS at Z.com, updated `vite.config.js` to `base: './'`, deployed to GitHub Pages with custom domain.
Current focus: Product image upload Supabase migration, then QR standee PDF.