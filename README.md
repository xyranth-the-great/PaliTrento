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

For an existing project, run `supabase/store-submission.sql` in the SQL Editor to add store-submission columns and owner permissions.

## Deploy to GitHub Pages
The GitHub Actions workflow builds the app with Vite and publishes `dist/`. In repository **Settings → Pages**, set the build and deployment source to **GitHub Actions**. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository secrets to connect the production site to Supabase; without them, built-in sample data is used.

## Preview through ngrok
For a site served from the ngrok domain root, run `npm run build:ngrok`, then `npm run preview -- --host 0.0.0.0 --port 4173` and start the tunnel with `ngrok http 4173`. This builds with relative asset paths, unlike the GitHub Pages subpath build above.

## Pages
index (home + Bantay Presyo board), explore (search + filters), map (Leaflet), products (price caps), business?trn=TRN-2024-089 (detail), settings (Profile, Notifications, Privacy, Security, Preferences, Danger Zone), forgot-password (request reset link), reset-password (set new password)

## Not built yet
SMS OTP login (see note below), merchant and admin screens, orders, chat.
Supabase phone login supports Twilio, MessageBird, Vonage and Textlocal. For a Philippine gateway like Semaphore you need an Auth "Send SMS" hook (Edge Function).
Verify the barangay list in `js/ui.js` against the official PSGC list.

## ✅ Recently Completed (2026-11-13)
- Settings page (`settings.html`, `js/settings.js`) — 6 tabs: Profile, Notifications, Privacy, Security, Preferences, Danger Zone
- Supabase SMTP via Resend — Confirm email ON, password reset & email confirmations enabled
- Product image upload (Supabase migration + Dashboard integration)
- QR Standee PDF (`standee.html` — A5/A4 printable store signage)
- Resend domain `palitrento.online` verified (production sender configured)
- GitHub Actions automated deployment with Supabase secrets
- **Forgot password / Reset password** — `forgot-password.html` + `reset-password.html` with Supabase `resetPasswordForEmail` and `updateUser`
