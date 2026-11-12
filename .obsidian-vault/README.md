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

## Pages
index (home + Bantay Presyo board), explore (search + filters), map (Leaflet), products (price caps), business?trn=TRN-2024-089 (detail)

## Not built yet
SMS OTP login (see note below), merchant and admin screens, orders, chat.
Supabase phone login supports Twilio, MessageBird, Vonage and Textlocal. For a Philippine gateway like Semaphore you need an Auth "Send SMS" hook (Edge Function).
Verify the barangay list in `js/ui.js` against the official PSGC list.