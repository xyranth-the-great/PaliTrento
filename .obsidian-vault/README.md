# PaliTrento (first pass: public pages)
Tara, Palit Ta sa Trento! Vite + vanilla JS + Supabase + Leaflet.

## Run it
1. `npm install`
2. `cp .env.example .env` and paste your Supabase URL and anon key (optional: without keys, the pages use built-in sample data)
3. `npm run dev`  -> http://localhost:5173

## Connect Supabase
1. Create a project at supabase.com
2. SQL Editor: run `supabase/schema.sql`, then `supabase/seed.sql`
3. Project Settings > API: copy the Project URL and the `anon` public key into `.env`
The anon key is safe to expose. Security comes from the row-level security rules in `schema.sql`.

## Recent application updates (2026-11-14)
- Featured products appear on Home, Explore, and Products. All three carousels now extend **edge-to-edge** (full viewport width) with headings contained in `.wrap`. Cards are smaller (gap 12px, padding 10px, compact typography).
- **Stores near the center** carousel on Home also edge-to-edge with same behavior.
- Carousels: continuous seamless leftward marquee (25s loop), **drag-to-scroll with momentum on desktop**, **native touch scroll + scroll-snap on mobile**. Pauses on touch (mobile) or drag/hover/focus (desktop), resumes after interaction. Respects `prefers-reduced-motion`.
- No pause/play button — cleaner UI.
- Business owners see **My Products**, which opens their store's product list in the dashboard. Customers retain **My Orders**; admins and business owners do not get an `orders.html` navigation link.
- New Google accounts choose **Customer** or **Business owner** after OAuth. Customers continue Home; business owners continue to store setup.
- Seller chat can show the customer's name through the participant-checked SQL function in `chat-customer-name.sql`.
- Certificate-compliance enforcement was undone. The optional DTI/BMBE permit flow remains, and the visible store badge wording is **Verified**.
- Seller store edits preserve the existing TRN code, the seller Home link no longer reloads the dashboard, the Admin Dashboard title was simplified, and Email digest was removed from Notifications.
- Account deletion is implemented through a server-side `delete-account` Edge Function; confirm it is deployed and working before relying on it in production.

Run `supabase/product-demo-payments.sql` on the connected Supabase project for the `featured_until` column. Run `supabase/google-auth-role.sql` after `supabase/schema.sql` to enable Google account role selection. Run `supabase/chat-customer-name.sql` after `supabase/orders.sql` and `supabase/chat.sql` to enable customer names in seller chat. Confirm these migrations are applied to the production project.
Carousel verification: production build passed; headless Chrome confirmed motion, looping, and Pause behavior with motion enabled, and confirmed reduced-motion behavior. Still visually check actual promoted products on desktop and mobile. If the page says “Motion reduced,” check Windows Settings → Accessibility → Visual effects → Animation effects.

## Deploy to GitHub Pages (Custom Domain)
**Domain:** `palitrento.online` (configured 2026-11-12)

1. **DNS at Z.com:**
   - 4 A records: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (GitHub Pages)
   - 1 CNAME: `www` → `xyranth-the-great.github.io.` (GitHub Pages)
   - Resend records:
     - TXT `resend._domainkey` (DKIM)
     - CNAME `rsend` → `rsend-apne1.forge.rmta.net`
     - CNAME `send` → `send.forge.rmta.net`
     - TXT `_dmarc` → `v=DMARC1; p=none;`
2. **GitHub Pages:** Custom domain `palitrento.online` + Enforce HTTPS (Source: GitHub Actions)
3. **vite.config.js:** `base: './'` (for custom domain, no subpath), `outDir: 'dist-fix'`
4. **GitHub Actions:** `.github/workflows/deploy.yml` — builds with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` repo secrets, deploys `dist-fix` to `gh-pages`
5. **Deploy:** Push to `main` → GitHub Actions runs → live at `https://palitrento.online`

## Resend Email (Production)
- Domain `palitrento.online` verified at `resend.com/domains`
- Edge Function `send-email-otp` sender: `PaliTrento <no-reply@palitrento.online>`
- Test mode: Only `kenteyy2@gmail.com` can receive (until domain verified)

## Supabase SMTP (Password Reset & Email Confirmations)
- Host: `smtp.resend.com`
- Port: `587`
- Username: `resend`
- Password: Resend API key (`re_...`)
- Sender: `no-reply@palitrento.online` (PaliTrento)
- Confirm email: ON

## Pages
index (home + Bantay Presyo board), explore (search + filters), map (Leaflet), products (price caps), business?trn=TRN-2024-089 (detail), settings (Profile, Notifications, Privacy, Security, Preferences, Danger Zone)

## Not built yet
SMS OTP login (see note below), price broadcast push, push notifications, offline field inspector.
Supabase phone login supports Twilio, MessageBird, Vonage and Textlocal. For a Philippine gateway like Semaphore you need an Auth "Send SMS" hook (Edge Function).
Verify the barangay list in `js/ui.js` against the official PSGC list.

## ✅ Recently Completed (2026-11-13)
- Settings page (`settings.html`, `js/settings.js`) — 6 tabs: Profile, Notifications, Privacy, Security, Preferences, Danger Zone
- Supabase SMTP via Resend — Confirm email ON, password reset & email confirmations enabled
- Product image upload (Supabase migration + Dashboard integration)
- QR Standee PDF (`standee.html` — A5/A4 printable store signage)
- Resend domain `palitrento.online` verified (production sender configured)
- GitHub Actions automated deployment with Supabase secrets