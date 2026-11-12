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

1. DNS at Z.com: 4 A records (185.199.108–111.153) + 1 CNAME (www → xyranth-the-great.github.io.)
2. GitHub Pages: Custom domain `palitrento.online` + Enforce HTTPS
3. `vite.config.js`: `base: './'` (for custom domain, no subpath)
4. `npm run build`, push to main → GitHub Actions deploys to gh-pages

## Pages
index (home + Bantay Presyo board), explore (search + filters), map (Leaflet), products (price caps), business?trn=TRN-2024-089 (detail)

## Not built yet
SMS OTP login (see note below), merchant and admin screens, orders, chat.
Supabase phone login supports Twilio, MessageBird, Vonage and Textlocal. For a Philippine gateway like Semaphore you need an Auth "Send SMS" hook (Edge Function).
Verify the barangay list in `js/ui.js` against the official PSGC list.