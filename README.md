# PaliTrento

**Tara, Palit ta sa Trento!** PaliTrento is a community marketplace for Trento, Agusan del Sur. It helps people discover nearby stores, compare local product prices, and connect with local sellers.

PaliTrento is available as a **website** and an **Android mobile app**. Both versions connect to the same Supabase backend.

## Use PaliTrento

- **Website:** [palitrento.online](https://palitrento.online)
- **Android app:** [Download the latest testing APK](https://github.com/xyranth-the-great/PaliTrento/releases/tag/android-v1.0.0-test.2)

The Android APK is currently a testing release. It is signed with a development key and is not a Google Play production build.

## What you can do

- Find local stores and market products, and search or browse by category.
- Compare prices with Bantay Presyo advisories and LGU price caps.
- Explore stores on the map and find nearby businesses.
- Reserve products for pickup and follow order updates or chat with the seller.
- Create a store and manage product listings, orders, and store information.
- Verify businesses, manage marketplace listings, and publish price advisories through the admin tools.

## Project versions

| Version | Location | Stack |
| --- | --- | --- |
| Website | Repository root | Vite, JavaScript, Supabase, Leaflet |
| Android app | [`mobile/`](mobile/) | Expo, React Native, TypeScript |

The website and mobile app have separate dependency manifests and setup steps. The mobile project also has a detailed [development handoff](mobile/HANDOFF.md), including native Android build notes.

## Run the website locally

From the repository root:

```sh
npm ci
```

Copy `.env.example` to `.env` and set the Supabase project URL and public anon key. Then start the Vite development server:

```sh
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Run the Android app locally

1. Change to `mobile/` and install its dependencies with `npm ci`.
2. Copy `mobile/.env.example` to `mobile/.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. For Android Firebase push notifications, place your Firebase `google-services.json` at `mobile/google-services.json`. This file is local configuration and must not be committed.
4. Start Expo with `npx expo start`.

The checked-in `mobile/android/` directory includes intentional native patches. Read [mobile/HANDOFF.md](mobile/HANDOFF.md) before building Android or changing native configuration. Do not run `expo prebuild --clean` without reviewing those notes.

## Supabase setup

Create a Supabase project, then run `supabase/schema.sql` and `supabase/seed.sql` in the SQL Editor for a new database. The website and mobile app use the project's public anon key; access is controlled by database policies. Never put a service-role key in either app or commit it to the repository.

For an existing database, apply the relevant SQL files in `supabase/`. Depending on the features enabled, these include store submissions and product approval, custom product units, orders and reservation notifications, chat customer names, and Google sign-up role selection. Review each SQL file and its prerequisites before applying it.

Account deletion uses the `delete-account` Supabase Edge Function. Deploy and configure server-side functions separately; keep service-role credentials in Supabase secrets.

## Deploy the website

The website is deployed to GitHub Pages with GitHub Actions. In repository settings, choose **GitHub Actions** as the Pages deployment source and configure the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` repository secrets.

For a temporary ngrok preview from the repository root:

```sh
npm run build:ngrok
npm run preview -- --host 0.0.0.0 --port 4173
```

Then expose port `4173` with ngrok.
