# PaliTrento: Handoff README

> Date written: 2026-11-10. Updated: 2026-11-12. Paste this whole file into a new chat and say:
> "Read this and continue from the 'Where we stopped' section."

---

## 0. How the new Claude should work with me

- **Act as my step-by-step assistant.** Do NOT build the project yourself unless I ask. Guide me one step at a time, tell me exactly where to click, and wait for my result before the next step.
- When code is needed, write a **ready-to-paste instruction for Claude Code** (my coding agent in VS Code). Claude Code reads `CLAUDE.md` in my project root.
- I am a beginner. Explain simply, give exact menu names, and tell me what I should see after each step.
- Be honest when you are unsure or inferring. Tell me to verify anything about prices or provider features that may change.
- **Never ask me for secret keys.** Never put the `service_role` key or any `sb_secret_...` key in the project. The public key (`sb_publishable_...` or the old "anon" key) is safe in the browser.
- Don't paste my real Supabase URL/keys into chats. Use placeholders.

---

## 1. What the project is

**PaliTrento** ("Tara, Palit Ta sa Trento!"): a local directory and marketplace for the **Municipality of Trento, Agusan del Sur, Philippines**. Residents find nearby stores, products, prices, and a map. It shows LGU (municipal) price-cap transparency and trust badges (LGU verified, DTI/BMBE registered).

**Two source specs existed. My decisions:**

| Topic | Decision |
|---|---|
| Stack | Vite + vanilla JS (ES modules), no framework |
| Colors / style | Forest green `#1f4d2e`, harvest amber `#e59834`, ivory `#fcf9f2`, font Plus Jakarta Sans |
| Features | Price-cap (SRP) pills, verification badges, barangay filter, open-now, map |
| Backend | Supabase (Postgres + Auth + Storage + Realtime) |
| Login | Planned SMS OTP; **currently email/password** (SMS later) |
| Scope so far | Public pages + login/account + merchant onboarding/dashboard + pickup orders + chat |

**Long-term roadmap (33 screens):** merchant onboarding/dashboard, product detail + pickup orders, buyer-seller chat, LGU admin (verification queue, price broadcasts), offline field-inspector audit tool, QR standees.

---

## 2. Current project structure (in my VS Code folder `palitrento2`)

```
index.html  explore.html  map.html  products.html  business.html
register.html  login.html  account.html  verify.html
register-business.html  store-setup.html  dashboard.html  chat.html  orders.html
admin.html  admin-verification.html  admin-prices.html  admin-reports.html
css/styles.css          (design tokens + components)
js/supabase.js          (client; null if env keys missing -> pages use seed data)
js/data.js              (getStores/getProducts/getStore; falls back to js/seed.js)
js/seed.js              (8 FAKE sample stores; used only if Supabase is empty/unreachable)
js/ui.js                (renderChrome nav/footer, cards, helpers, CATS/UNITS/PAY/BARANGAYS)
js/auth.js              (getSession, getProfile, signOut, onAuthStateChange, email OTP, unread badge listener)
js/storage.js           (Supabase Storage upload for store images)
js/home.js explore.js products.js business.js map.js
js/register.js login.js account.js verify.js register-business.js store-setup.js dashboard.js chat.js orders.js
js/admin.js admin-verification.js admin-prices.js admin-reports.js
supabase/schema.sql  supabase/seed.sql  supabase/add-store.sql  supabase/email-otp.sql  supabase/orders.sql  supabase/chat.sql  supabase/admin.sql  supabase/admin-notes.sql  supabase/product-images.sql
vite.config.js  (multi-page, target es2022, base: './')  .env  .env.example  CLAUDE.md  README.md
```

- `.env` (real values, gitignored) lives next to `package.json`. `.env.example` has placeholders only.
- Run: `npm install` then `npm run dev` -> http://localhost:5173. Restart it after editing `.env`.
- Leaflet map uses OpenStreetMap tiles. Build check: `npm run build`.

---

## 3. Supabase state (what I have already run)

**Tables:** `stores`, `products`, `profiles`, `orders`, `messages`, `advisories`, `email_otp_codes`.

**stores columns:** id, trn_code (unique, TRN-YYYY-NNN), business_name, trade_category (SARI_SARI|CARINDERIA|FRESH_PRODUCE|PHARMACY|SERVICES|AGRI), proprietor_name, contact_number (+63...), barangay, purok, landmark_reference, lat, lng, bmbe_registered, dti_registered, srp_compliant, verification_status (PENDING|VERIFIED|REJECTED|CLARIFICATION_REQUIRED), open_time, close_time, accepted_payments text[] (CASH|GCASH|TRIKE_COD), storefront_image_url, permits_image_url, admin_notes, verified_at, verified_by, user_id (FK to auth.users), created_at.

**products columns:** id, store_id, name, category, unit (KG|PC|POUCH|BOTTLE|SACK_25KG|TIE), current_price, lgu_srp_ceiling (null = no cap), in_stock, quantity, image_url, created_at.

**profiles columns (NO email column; email lives in Supabase Auth):** id (= auth user id), full_name, role (customer|business_owner|admin), barangay, created_at, avatar_url.

**orders columns:** id, buyer_id, store_id, product_id, quantity, total_price, status (PENDING|CONFIRMED|READY_FOR_PICKUP|COMPLETED|CANCELLED), payment_method (CASH|GCASH|TRIKE_COD), notes, confirmed_at, ready_at, completed_at, created_at.

**messages columns:** id, order_id, sender_id, content, read_at, created_at.

**advisories columns:** id, title, body, category (PRICE_CAP|ANNOUNCEMENT|EMERGENCY|GENERAL), barangay, priority, published_at, expires_at, created_by, created_at.

**email_otp_codes columns:** id, email, code, purpose, expires_at, used_at, created_at.

**Data in the database:** 4 FAKE sample stores (TRN-2024-089, -012, -031, -057) kept for development, plus 1 real store **BEKIK traveller's KAMBINGAN and native chicken** (TRN-2026-090, Poblacion Purok 5, near D.O Plaza Park, 3 products). Before showing the site to others, delete the fake ones:

```sql
delete from stores where trn_code in ('TRN-2024-089','TRN-2024-012','TRN-2024-031','TRN-2024-057');
```

**Verification caution:** BEKIK was set to VERIFIED and srp_compliant=true. If the municipality has not actually verified it, revert:

```sql
update stores set verification_status='PENDING', srp_compliant=false where trn_code='TRN-2026-090';
```

### SQL already run: profiles + sign-up trigger (security important)

```sql
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'customer' check (role in ('customer','business_owner','admin')),
  barangay text,
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "read own profile" on profiles for select using (auth.uid() = id);
create policy "update own profile" on profiles for update using (auth.uid() = id);
-- users can change only name and barangay, never role:
revoke update on profiles from anon, authenticated;
grant update (full_name, barangay) on profiles to authenticated;
```

### SQL already run: profile photos

```sql
alter table profiles add column if not exists avatar_url text;
grant update (full_name, barangay, avatar_url) on profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars','avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=2097152,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create policy "own avatar select" on storage.objects for select to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "own avatar insert" on storage.objects for insert to authenticated
  with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "own avatar update" on storage.objects for update to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "own avatar delete" on storage.objects for delete to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
```

(The avatars bucket is public: anyone with a photo link can view it. That's normal for profile pictures.)

**Supabase settings:** Email provider ON; **Confirm email OFF**; Site URL `https://palitrento.online`; Redirect URL `https://palitrento.online/**` (keep `http://localhost:5173/**` for dev). The built-in email sender allows only a few emails per hour (testing only). Use a Gmail address for tests, because my school `.edu.ph` address may delay or block automated email. Before launch, set up a proper SMTP email service.

---

## 4. Bugs found and fixed so far (history)

1. Explore showed 8 fake stores: my keys were in `.env.example`, not `.env`. Fixed by creating `.env` at the project root.
2. Register stuck on "Creating account...": `new URL(..., import.meta.env.BASE_URL)` crashed because BASE_URL is `./`. Fix: `new URL('login.html', window.location.href).href`, and wrap sign-up in try/catch/finally so the button never sticks.
3. Account page: nav still showed Log in/Register when logged in (account.js did not pass the session to renderChrome); account page was read-only; register had no Barangay dropdown. Fix instruction was given to Claude Code (editable name/barangay, optional barangay dropdown, nav login state).
4. **Profile photo + nav icon** requested: round avatar icon in the menu replacing the "My account" text; upload on the account page (JPG/PNG/WebP, max 2 MB, crop to 256x256, stored at `avatars/<user id>/avatar-<timestamp>.webp`, old file deleted, "Remove photo" button). Instruction was given to Claude Code.
5. **Account page bug:** saving name/barangay works (the data changes in the database) but an error message "Something went wrong. Please try again." still appears. Console showed:
   ```
   GET .../rest/v1/profiles?select=full_name,email,role,barangay&id=eq.<uid>  -> 400
   Failed to load resource: 404 (Not Found)   <- probably /favicon.ico, harmless
   ```
   **Cause:** the code requests an `email` column from `profiles`, which doesn't exist. Email must come from `session.user.email`. The save succeeds, then the reload request fails and shows the error.
   **Fix instruction for Claude Code:**
   ```
   Bug on account.html: saving shows "Something went wrong". Console: 400 on
   /rest/v1/profiles?select=full_name,email,role,barangay. The profiles table has
   NO email column (id, full_name, role, barangay, avatar_url, created_at).
   1. Search js/auth.js, account.js, ui.js, register.js, login.js for any select()
      on profiles that includes "email"; remove it. Select only full_name, role,
      barangay, avatar_url.
   2. Show email from session.user.email.
   3. Save updates ONLY full_name and barangay (and avatar_url in the photo flow);
      never role or email. If the update succeeds but a reload fails, still show
      "Saved". try/catch/finally so buttons never stay stuck.
   4. console.error the real Supabase error (message, code) while showing a
      friendly message.
   5. Find out what the other 404 is; if favicon, add a favicon.
   6. npm run build and report what changed. Don't touch .env, SQL, RLS, settings.
   ```

**First thing to ask me:** did I run that fix, and after restarting `npm run dev` + hard refresh (Ctrl+Shift+R), does saving now show "Saved" with no red 400 in the Console? If still failing, ask for the Network tab (filter `profiles`) Status + Response of the failing request.

---

## 5. WHERE WE STOPPED (open bug)

**The account page save bug above is FIXED.** The email column was removed from the profiles select, error handling improved, favicon added.

**Next features completed since then:**

6. **Email OTP verification with Resend** (instead of Supabase confirmation links)
   - Created `supabase/email-otp.sql` (email_otp_codes table + RLS)
   - Created Edge Function `send-email-otp` (uses Resend API)
   - Created Edge Function `verify-email-otp` (verifies codes)
   - Created `verify.html` + `js/verify.js` (6-digit input, auto-focus, paste support, resend with 60s cooldown)
   - Updated `register.js` to send OTP instead of Supabase confirmation link
   - Disabled Supabase "Confirm email" (Email provider ON, Confirm email OFF)

7. **Avatar dropdown menu** (hover desktop, click mobile)
   - Items: "My Account", "Settings" (future), "Log out"
   - Shows name/email in header

8. **Merchant onboarding** (3-step wizard)
   - `register-business.html` → `verify.html?next=store-setup` → `store-setup.html` (details, map pin, photos) → `dashboard.html`
   - `store-setup.js`: Leaflet map, browser geolocation, photo upload to `store-images` bucket

8. **Business owner dashboard**
   - Products CRUD (add/edit/delete, stock toggle, SRP cap)
   - Orders tab: Confirm → Ready → Complete workflow
   - Analytics tab: product count, order count, revenue

9. **LGU Admin dashboard**
   - `admin.html`: stats cards, quick actions
   - `admin-verification.html`: filterable queue, review modal (Approve/Clarification/Reject), admin notes
   - `admin-prices.html`: create broadcasts, list sent
   - `admin-reports.html`: overview stats, category/barangay breakdown, price cap compliance

10. **Pickup Orders**
    - `product-detail.html`: reserve for pickup, payment method, quantity
    - `dashboard.js` Orders tab: Confirm → Ready → Complete
    - `account.js` "My Orders" tab: customer order history

11. **Buyer-Seller Chat (Supabase Realtime)**
    - `chat.html` + `js/chat.js`
    - Real-time messaging per order
    - Optimistic UI, read receipts, mark-as-read

12. **Unread Message Badge (Real-time, cross-page)**
    - Red badge on avatar (top-right) shows total unread messages
    - Global Realtime listener (`auth.js` → `startUnreadListener`) subscribes to all user's orders
    - Badge increments instantly when new message arrives, clears when chat opened
    - Badge always renders (hidden when 0) so realtime can find it

13. **My Orders page** (`orders.html`)
    - Separate page for order history, accessible via main nav "My Orders"
    - Avatar dropdown also links to `orders.html`
    - Product detail redirects to `orders.html` after reserve

14. **Account page fix** — Removed Orders tab, now Profile only
    - `account.html` no longer has tabs; `account.js` only handles profile/avatar

15. **Profile save bug fix** — Removed `email` from profiles select
    - Fixed 400 error in `js/auth.js` and `js/dashboard.js`

16. **Product detail redirect** → `orders.html` after reserve

17. **Custom domain `palitrento.online` configured** (2026-11-12)
    - DNS records added at Z.com (4 A records + 1 CNAME)
    - GitHub Pages custom domain enabled with Enforce HTTPS
    - `vite.config.js` updated: `base: './'` (for custom domain, no subpath)
    - Supabase Auth URLs updated to `https://palitrento.online`

---

## 6. Next steps after the bug is fixed

**Current blocker: Product image upload**

The frontend is ready (`js/dashboard.js`, `js/storage.js` handle upload), but the **Supabase migration for `product-images` bucket has not been run**. Run this in Supabase SQL Editor:

```sql
-- 1. Add image_url column to products table
alter table products add column if not exists image_url text;

-- 2. Create product-images storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set 
  public = true, 
  file_size_limit = 5242880, 
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- 3. Drop existing policies (if any)
drop policy if exists "owner upload product image" on storage.objects;
drop policy if exists "owner update product image" on storage.objects;
drop policy if exists "owner delete product image" on storage.objects;
drop policy if exists "public read product images" on storage.objects;

-- 4. Create fresh policies
create policy "owner upload product image" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner update product image" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner delete product image" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "public read product images" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');
```

**After running migration:** test Dashboard → Edit product → Upload image → Save → Check Console for success.

---

## 7. Custom Domain Setup (Completed 2026-11-12)

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

## 8. Conversation log (condensed)

1. I pasted two specs and asked Claude to ask questions first. Claude flagged the conflicts; I chose Vite + Doc 1 stack, Doc 2 colors/features/login, public pages first, Supabase.
2. Claude built the first pass (5 public pages + Supabase schema/seed) and delivered `palitrento.zip`; later wrote `CLAUDE.md` for Claude Code.
3. I asked about free SMS providers. Answer: none truly free; PhilSMS cheapest (no setup/minimum), Semaphore a bit higher; start with email login. I then said to just guide me step by step instead of building.
4. I ran the project, connected Supabase (fixed `.env` vs `.env.example` problem), added my first real store via Claude Code-generated SQL.
5. Built email/password login with Claude Code; fixed the URL crash on register; hit the account-page issues; requested avatar upload; hit the `email` column 400 error (current open bug).
6. I asked for this README to continue in another account.
7. **2026-11-12:** Purchased `palitrento.online` domain, configured DNS at Z.com, updated vite.config.js for custom domain, deployed to GitHub Pages.
8. **2026-11-12 (later):** Added GitHub Actions workflow (`.github/workflows/deploy.yml`) for automated deployment to GitHub Pages with Supabase secrets. Fixed deploy path to `dist-fix`. Added Resend DNS records at Z.com (DKIM, CNAME rsend/send, DMARC). Verified `palitrento.online` in Resend. Updated `send-email-otp` Edge Function sender to `no-reply@palitrento.online` and deployed to Supabase.

---

## 9. Supabase Edge Functions deployed

| Function | Purpose |
|---|---|
| `send-email-otp` | Sends 6-digit code via Resend |
| `verify-email-otp` | Verifies code, marks used |

**Secrets set in Supabase Dashboard → Edge Functions:**
- `RESEND_API_KEY` (starts with `re_`)
- `SUPABASE_URL` = `https://xcbkpknsieawtzyfwrff.supabase.co`
- `SERVICE_ROLE_KEY` (the `sb_secret_...` key from Settings → API)

---

## 10. Resend domain

**Test mode:** Only `kenteyy2@gmail.com` can receive emails (verified sender). For production, verify a domain at `resend.com/domains`, then update `from:` address in `send-email-otp` Edge Function (line 77) to use your domain.

---

## 11. What to do in a new chat

1. **Paste this README** and say: "Read this and continue from the 'Where we stopped' section."
2. I'll tell you where I am (likely testing the chat badge flow).
3. You guide me step by step — one command/click at a time.
4. When code is needed, write a ready-to-paste instruction for **Claude Code** (my coding agent in VS Code).

---

## 12. Key files to know

| File | Purpose |
|---|---|
| `CLAUDE.md` | Context for Claude Code (reads automatically) |
| `js/auth.js` | Auth, profile, email OTP, unread badge listener |
| `js/ui.js` | renderChrome, avatar dropdown, badge rendering |
| `js/chat.js` | Realtime chat, optimistic UI, badge integration |
| `js/dashboard.js` | Seller dashboard (products, orders, analytics) |
| `js/account.js` | Account page (profile, avatar) |
| `js/orders.js` | My Orders page (order history) |
| `js/store-setup.js` | 3-step store onboarding wizard |
| `js/storage.js` | Supabase Storage upload helpers |
| `supabase/*.sql` | All migrations (run in SQL Editor) |

---

## 13. Environment variables (`.env`)

```env
VITE_SUPABASE_URL=https://xcbkpknsieawtzyfwrff.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Never commit `.env`** — it's in `.gitignore`.

---

## 14. Deploy notes

- GitHub Pages: Custom domain `palitrento.online` enabled, `npm run build` publishes to `gh-pages` branch
- Repo secrets for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Before launch: real SMTP for emails, verify Resend domain (`palitrento.online`), set real Site URL/redirects in Supabase

---

**End of handoff.** Paste this into a new chat and say: "Read this and continue from the 'Where we stopped' section."