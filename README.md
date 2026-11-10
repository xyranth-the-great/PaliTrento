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

## Deploy to GitHub Pages
`BASE_PATH=/PaliTrento/ npm run build`, then publish `dist/`. Add the two VITE_ values as repository secrets.

## Preview through ngrok
For a site served from the ngrok domain root, run `npm run build:ngrok`, then `npm run preview -- --host 0.0.0.0 --port 4173` and start the tunnel with `ngrok http 4173`. This builds with relative asset paths, unlike the GitHub Pages subpath build above.

## Pages
index (home + Bantay Presyo board), explore (search + filters), map (Leaflet), products (price caps), business?trn=TRN-2024-089 (detail)

## Not built yet
SMS OTP login (see note below), merchant and admin screens, orders, chat.
Supabase phone login supports Twilio, MessageBird, Vonage and Textlocal. For a Philippine gateway like Semaphore you need an Auth "Send SMS" hook (Edge Function).
Verify the barangay list in `js/ui.js` against the official PSGC list.
