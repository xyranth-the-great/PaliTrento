# PaliTrento Mobile — AI Handoff & Roadmap

> **Read this file first.** It describes the state of the project, how to build it on this Windows machine,
> the conventions used, the pitfalls already solved, and the remaining work in priority order.
> Last updated: 2026-11-20 (after "Website Effects, Custom Showcases, Marquee Carousel & Liquid Gold Chrome").

---

## 1. What this project is

**PaliTrento** is a local marketplace for the Municipality of **Trento, Agusan del Sur (Philippines)**:
customers find verified stores, compare prices against LGU price caps ("Bantay Presyo"), reserve products
for pickup, and chat with sellers. Business owners manage stores/products/orders. Admins verify stores and
send price advisories.

There are **two separate codebases that share one Supabase backend**:

| Folder | What | Rules |
|---|---|---|
| `..` | **The website** (Vite + vanilla JS, multi-page, 38 pages). Deployed to `palitrento.online` via GitHub Pages. | **Do NOT modify.** It is the source of truth for business logic. Read it to learn queries/RPCs/rules. |
| `mobile` | **This app** — React Native (Expo SDK 58, TypeScript, Expo Router). | All mobile work happens here. |
| `legacy Capacitor wrapper` | An abandoned Capacitor (web-wrapper) attempt. | Obsolete. Ignore / safe to delete. |
| `legacy desktop shortcut` | Desktop shortcut → `mobile`. | — |

The mobile application is integrated under the repository's mobile/ folder. Website and mobile sources remain separate and use their own package configuration.

The owner tests on **LDPlayer** (Android emulator, adb serial `emulator-5554`). iOS is out of scope for now.

---

## 2. Tech stack

- Expo **SDK 58**, React Native **0.88**, React **19.3**, TypeScript (strict), **Expo Router** (typed routes on).
- Supabase JS v2 with AsyncStorage session persistence (`lib/supabase.ts`). Keys in `.env`
  (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) — copied from the website's `.env`.
- UI: custom design system (no UI library). Font **Plus Jakarta Sans** (`@expo-google-fonts/plus-jakarta-sans`),
  `expo-linear-gradient`, `@expo/vector-icons` (Ionicons).
- Maps: Leaflet/OpenStreetMap inside `react-native-webview` (no Google Maps API key needed).
- Native modules in use: expo-location, expo-notifications, expo-web-browser, expo-image-picker,
  expo-image-manipulator, expo-splash-screen, expo-font.
- **AGENTS.md** (Expo template) says to check versioned Expo docs before using any Expo API — follow that.
  Note: its mention of `src/app/` is from the template; this project uses **`app/`** at the root.

---

## 3. Project structure

```
app/                         Expo Router screens (file = route)
  _layout.tsx                Root: fonts, AuthProvider, splash overlay, ROUTE GUARD (see §4)
  onboarding.tsx             3-slide intro (first launch)
  permissions.tsx            Location + notifications permission cards
  auth-status.tsx            Suspended/banned screen (forced when profile is restricted)
  choose-role.tsx            New Google users pick Customer / Business owner
  terms.tsx                  Terms text, loaded from assets/terms.json (extracted from the website)
  notifications.tsx          Unified Notification Inbox (advisories, orders, reservations, messages; read/dismiss)
  report-business.tsx        Report verified business (`create_business_report`)
  report-product.tsx         Report verified product (`create_product_report`)
  support.tsx                Help & Support (My Tickets + thread replies, New Ticket w/ attachment, FAQs)
  settings.tsx               5-tab Settings (Profile, Notifications, Privacy & data export, Security, Danger Zone)
  (auth)/login|register|verify|forgot-password.tsx
  (tabs)/_layout.tsx         Custom bottom tab bar, ROLE-AWARE (customer: Orders, business_owner: Store, admin: Admin)
  (tabs)/index.tsx           Home (with notification bell)   (tabs)/explore.tsx  Explore (priority search)   (tabs)/map.tsx  Map
  (tabs)/orders.tsx          Customer orders (live 72h pickup countdown)   (tabs)/store.tsx  Seller dashboard   (tabs)/admin.tsx  Admin home
  (tabs)/account.tsx         Profile
  store/[trn].tsx            Public store page (+ Report Business)      product/[id].tsx  Product detail + reserve + Related + Report
  chat/[orderId].tsx         Realtime order chat
  seller/product-form.tsx    Add/edit product (photos + ₱1 demo payment)   seller/bulk-products.tsx  Bulk add products
  seller/standee.tsx         Store QR standee (real SVG QR, fullscreen kiosk, share, A5/A4 PDF)   seller/store-setup.tsx  Store setup/edit + permits
  admin/store/[id].tsx       Admin store review (permits, approve/clarify/decline, restore suspended)
  admin/advisory.tsx         Send Bantay Presyo & public advisory
  admin/accounts.tsx         Accounts moderation (warn, suspend, ban, restore, remove Premium)
  admin/reports-management.tsx Business & product reports queue (notes + status RPC)
  admin/support.tsx          Admin support inbox (ticket thread, replies, attachments, status)
  admin/marketplace.tsx      Marketplace hide/restore stores & products + LGU price cap editor
  admin/pickup-cases.tsx     Pickup 72h no-show cases (linked to account moderation)
  admin/verification-docs.tsx Submitted business verification documents (signed viewer + review RPC)
  admin/reports.tsx          Platform overview (store/product/order KPIs, SRP compliance, category/barangay)
  admin/activity.tsx         Immutable audit log viewer (`audit_logs`)
components/
  ui.tsx                     Design-system primitives: ScreenHeader, Card, SectionLabel, Field, Chip, ChipGroup,
                             Button (primary|amber|soft|danger|outline), StatusPill, EmptyState, StatusBarCover, ORDER_STATUS
  StoreCard, ProductCard, LogoMark (SVG logo), AppSplash (animated splash), MapPicker (tap-to-pin), DocCard, reviewStyles,
  NotificationToast, DemoPaymentModal (QR demo checkout), QrCodeSvg (real ISO QR via qrcode-generator)
  effects/                   showcaseConfig, LiquidGoldChrome (LiquidGoldSurface, PremiumGoldFrame, PremiumChromePill,
                             PremiumUpgradeButton), FireShowcaseEffects (Charizard fire ring, embers, holo, 3D tilt,
                             ember price line), PikachuShowcaseEffects (electric ring, SVG bolts, sparkles, holo,
                             3D tilt, zig-zag price line), FeaturedMarqueeCarousel, WelcomePremiumCelebration
  seller/                    SubscriptionTab, VerificationTab, AnalyticsTab (modular tabs for Seller Dashboard)
  settings/                  NotificationsTab, PrivacyTab, SecurityTab, DangerZoneTab (modular tabs for Settings)
context/
  AuthContext.tsx            session, profile, onboarded, restriction, needsRoleChoice + all auth actions
  NotificationContext.tsx    unreadCount, realtime advisory/order/reservation/message toast banners
lib/
  theme.ts                   COLORS, FONTS, RADIUS, SHADOW, CATEGORY_VISUALS — ALWAYS use these tokens
  constants.ts               CATS, UNITS, PAY, BARANGAYS, PRODUCT_CATEGORIES, advisory enums, peso(), isStoreOpen(), etc.
  data.ts                    Public queries + priority search RPCs + related products + lock-state check + types
  notifications.ts           Unified notification inbox queries, mark-read, dismiss, 72h countdown, action URL mapping
  support.ts                 Business/product report RPCs, support tickets/messages RPCs, attachment upload, FAQs
  seller.ts                  Seller + core admin store queries, image upload (WebP), order status
  admin.ts                   Batch 4 admin API layer (accounts moderation, reports, support inbox, marketplace/caps, pickup cases, audit logs, docs, overview)
  settings.ts                Batch 5 settings layer (notification_preferences upsert, AsyncStorage privacy prefs, personal/chat data export, delete-account edge function, delete store)
  push.ts                    Batch 6 native push engine (4 Android channels, foreground handler, local system notifications, tap deep-linking, FCM device token sync to `mobile_push_tokens`, badge count)
  account.ts                 Email OTP (edge functions), password rules, restriction logic, Google role helpers
  pendingRegistration.ts     In-memory register→verify handoff (keeps password out of URLs)
assets/                      icons, splash, logo.png, terms.json
android/                     Generated by prebuild, BUT HAND-PATCHED (see §5) — do not blindly re-run prebuild
```

---

## 4. Key behaviors to preserve

- **Route guard** (`app/_layout.tsx`): not onboarded → `/onboarding`; no session → `/(auth)/login`;
  restricted profile → `/auth-status` (only screen allowed); new Google user → `/choose-role`;
  otherwise auth/onboarding screens redirect to `/(tabs)`. `/terms` is reachable from anywhere.
  `(auth)/verify` is allowed while a session appears (it navigates itself after sign-up).
- **Registration** mirrors the website: send 6-digit code via edge function `send-email-otp` → verify via
  `verify-email-otp` → only then `supabase.auth.signUp` → auto sign-in. Password rules: 8+ chars, upper, lower,
  number, special.
- **Google OAuth**: `expo-web-browser` auth session, redirect `palitrento://auth-callback` (scheme `palitrento`
  in app.json). This URL must be in Supabase → Auth → URL Configuration → Redirect URLs.
- **Business rules copied from the website** (keep in sync with `palitrento2/js/*.js`):
  - Visible stores: `verification_status='VERIFIED' OR approval_status='APPROVED'`, and `marketplace_removed_at` null.
  - Products hidden if store hidden, `marketplace_removed_at` set, or locked in `product_lock_states`.
  - Seller can manage products only when store is APPROVED/VERIFIED. 15 free listings; extra = ₱1 demo payment
    (`is_paid_listing`, then RPC `record_product_listing`). Premium = unlimited.
  - Order flow: PENDING → CONFIRMED → READY_FOR_PICKUP → COMPLETED (or CANCELLED with reason / EXPIRED),
    always via RPC `update_order_status`. Pickup deadline = `ready_at + 72h`.
  - Admin store approval requires all 3 permits APPROVED (`admin_review_store_permit`, then
    `admin_approve_store_submission`).
- **Image uploads**: resized to WebP (800px products / 1400px store) with expo-image-manipulator, uploaded to
  buckets `product-images` (`{uid}/products/{productId}/...`) and `store-images` (`{uid}/{folder}/...`).

---

## 5. Building & running (Windows) — READ BEFORE BUILDING

```powershell
$repoRoot = (Get-Location).Path
$mobileRoot = Join-Path $repoRoot 'mobile'
Set-Location $mobileRoot
npx tsc --noEmit                      # must be 0 errors before building

Set-Location (Join-Path $mobileRoot 'android')
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
.\gradlew.bat assembleRelease         # standalone APK (JS bundled, no Metro needed), ~1–4 min incremental

$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb -s emulator-5554 install -r (Join-Path $mobileRoot 'android\app\build\outputs\apk\release\app-release.apk')
& $adb -s emulator-5554 shell am start -n com.palitrento.mobile/.MainActivity
& $adb -s emulator-5554 logcat -d -s ReactNativeJS:E AndroidRuntime:E     # check for crashes
& $adb -s emulator-5554 shell screencap -p /sdcard/s.png; & $adb -s emulator-5554 pull /sdcard/s.png .
```

- If adb shows LDPlayer twice (`emulator-5554` and `127.0.0.1:5555`), always pass `-s emulator-5554`.
- Deep links work for quick screen checks: `adb shell am start -a android.intent.action.VIEW -d "palitrento://terms" com.palitrento.mobile`.
- `uiautomator dump` + regex on `text="..."` bounds is a reliable way to tap UI elements from scripts.
- Live web preview exists (`npx expo start --web --port 8081`) but is only a rough preview; LDPlayer is the truth.

### Hand-applied native patches (lost if you run `npx expo prebuild --clean`)
1. **Windows long-path fix for CMake/Ninja** — `android/short-paths.cmake`:
   `set(CMAKE_OBJECT_PATH_MAX 240 CACHE STRING "..." FORCE)`; and in `android/app/build.gradle`:
   `externalNativeBuild { cmake { buildStagingDirectory file("C:/pt-cxx") } }` plus
   `defaultConfig { externalNativeBuild { cmake { arguments "-DCMAKE_PROJECT_INCLUDE=.../short-paths.cmake" } } }`.
   Why: React Native's Gradle plugin passes `CMAKE_OBJECT_PATH_MAX=1024`; 240 makes CMake hash long object
   paths (values < ~181 are ignored by CMake). Without this, `react-native-safe-area-context` fails with
   "Filename longer than 260 characters".
2. `android/gradle.properties`: `reactNativeArchitectures=arm64-v8a,x86_64` (phones + LDPlayer; faster builds).
3. `AndroidManifest.xml`: `CAMERA` permission added (also listed in app.json, so a prebuild re-adds it).
→ **Recommended future task:** move patches 1–2 into a local Expo config plugin so prebuild is safe again.

### Typed routes
After adding a new screen, `tsc` reports "not assignable to type ..." for `router.push('/new-route')` until
route types regenerate. Regenerate by briefly running `npx expo start` until `.expo/types/router.d.ts`
contains the new route, then stop it and re-run `tsc`.

---

## 6. Conventions & gotchas

- **Never rewrite UTF-8 files with PowerShell `Get-Content`/`Set-Content`/`WriteAllText`** — it corrupted
  `₱`/`✦` once. Use editor tools, or Node with `'utf8'`.
- Styling: always `COLORS`/`FONTS`/`RADIUS`/`SHADOW` from `lib/theme.ts`; Plus Jakarta Sans via `fontFamily`
  (never `fontWeight` alone). Cards = white + 1px `COLORS.line` border + `SHADOW.card`. Prefer `components/ui.tsx`.
- Android custom-font clipping: small centered labels need `width:'100%'`, `textAlign:'center'`,
  `includeFontPadding:false`, and an explicit `lineHeight`.
- `expo-status-bar` in SDK 58 has no `backgroundColor` prop (edge-to-edge). Screens whose content scrolls to
  the top must render `<StatusBarCover />` (last child) so content doesn't slide under the clock.
- `StyleSheet.absoluteFillObject` doesn't exist in this RN version — use explicit `position:'absolute'` + edges.
- Custom tab bar receives `{ state, navigation?, emitter?, navigateToTab? }` (new bottom-tabs API) — typed `any`.
- When porting a website feature: open the matching `palitrento2/js/<page>.js` (or inline `<script>` in the
  `.html`) and copy the exact table names, columns, RPC names and parameters. Don't invent schema.
- The owner prefers: modern 2026 "super-app" look (Grab/Shopee style), compact mobile sizing, test every batch
  on LDPlayer with screenshots, and never touching the website.

---

## 7. Status

### Done
- Phase 1 (customer app): splash, onboarding, permissions, login/register/forgot, Home, Explore, Map,
  store page, product detail + reserve, orders (realtime), chat (realtime), profile, settings. 2026 redesign.
- Phase 2: role-based tabs; seller dashboard (stats, orders actions, products CRUD w/ photos, free-listing quota),
  store setup/edit with map pin + permits; admin home, store review (per-permit), send advisory.
- Batch 1 (safety & trust): suspended/banned screen + expired-suspension auto-restore, Google account-type step,
  email OTP registration, password strength meter, Terms + required checkbox.
- Batch 2 (customer essentials): unified Notification Inbox (`notifications.tsx`) + Home bell badge + live
  realtime in-app toast banners (`NotificationContext` + `NotificationToast`); Report Business & Report Product
  (`report-business.tsx`, `report-product.tsx`); Help & Support tickets, thread replies, attachments & FAQs
  (`support.tsx`); live 72h pickup countdown + cancellation reason on Orders; `product_lock_states` enforcement
  + "You may also like" related products on Product Detail; Premium-first priority search RPCs
  (`search_stores_with_priority`, `search_products_with_priority`) & real product categories on Explore.

- Batch 3 (seller business tools): 5-tab Seller Dashboard (`Orders`, `Products`, `Plan`, `Verification`, `Analytics`);
  Premium subscription card + 4 states (Active/Free/Grace/Expired) + Upgrade/Renew demo QR checkout
  (`get_subscription_dashboard_data`, `verify_payment_and_activate_subscription`, `DemoPaymentModal`);
  Featured Store promo (`verify_payment_and_create_featured_promo`); locked products list + bulk unlock
  (`product_lock_states`, `verify_payment_and_unlock_products`); Verification tab (`get_store_display_status`,
  `business_compliance`, one-time `acknowledge_business_approval`, 3-permit viewer); Bulk Add Products
  (`seller/bulk-products.tsx`); Store QR Standee (`seller/standee.tsx`, real scannable SVG QR, counter kiosk mode,
  share & printable A5/A4 PDF); Avatar upload/remove (`avatars` bucket in `settings.tsx`); Account warnings banner
  (`account_moderation_actions` in `account.tsx`); fuller seller analytics (revenue, pipeline, completion rate,
  7-day bar chart, status breakdown, payment split, top products, Bantay Presyo health).

- Batch 4 (admin tools): Upgraded Admin command center (`(tabs)/admin.tsx`) with 8 tool tiles + live open counts,
  search & barangay filters on Store Verification; Restore suspended store + shortcuts in `admin/store/[id].tsx`;
  Accounts moderation (`admin/accounts.tsx`, edge function `admin-account-moderation`: warn, temp/perm suspend, ban,
  restore, unban, remove Premium, moderation history); Reports management (`admin/reports-management.tsx`,
  `business_reports` + `product_reports`, `admin_update_report_status`); Support inbox (`admin/support.tsx`,
  `support_tickets` + `support_messages`, `add_support_message`, `admin_update_ticket_status`, signed attachments);
  Marketplace hide/remove & LGU price cap editor (`admin/marketplace.tsx`, `marketplace_removed_at`/reason +
  `lgu_srp_ceiling`); Pickup no-show cases (`admin/pickup-cases.tsx`, `pickup_no_show_cases`); Verification documents
  (`admin/verification-docs.tsx`, `business_documents` + signed URLs + `admin_review_business_document`);
  Platform reports overview (`admin/reports.tsx`); Activity/audit log (`admin/activity.tsx`, `audit_logs`);
  admin notification `action_url` deep-link mapping in `lib/notifications.ts`.

- Batch 5 (settings): 5-tab Settings screen (`settings.tsx` + `components/settings/*` + `lib/settings.ts`):
  Profile tab (avatar upload/remove, full name, read-only email & role, barangay); Notifications tab
  (`notification_preferences` Supabase upsert + AsyncStorage sync, OS push permission status & request);
  Privacy tab (5 toggles in AsyncStorage + native Share export of personal data & chat history);
  Security tab (current-password verification via `signInWithPassword`, Google initial password setup detection,
  show/hide password toggles, live 5-rule password strength bar); Danger Zone tab (admin guard, checkbox +
  typed `DELETE` account deletion via `delete-account` edge function, checkbox + typed `DELETE STORE` store
  deletion with storage cleanup and role demotion to customer).

- Batch 6 (native push notifications — LIVE & VERIFIED ON LDPLAYER):
  `lib/push.ts`, upgraded `NotificationContext.tsx`, upgraded `NotificationsTab.tsx`, conditional Firebase plugin
  in `android/build.gradle` & `android/app/build.gradle` (auto-copies `mobile\google-services.json` and
  applies `com.google.gms.google-services`), `"googleServicesFile": "./google-services.json"` in `app.json`,
  4 Android channels (`default`, `orders`, `messages`, `advisories`), real Android system alerts for live
  advisories/orders/reservations/messages, tap-to-open deep linking (foreground, background, cold-start), OS
  badge count syncing, "Send test notification" button, live FCM device token generation (`palitrento-acab5`)
  + rotation listener + verified sync to Supabase `public.mobile_push_tokens`, and ready-to-deploy Edge Function
  FCM v1 sender in `docs/send-fcm-push-reference.ts`.

- Website Effects, Custom Showcases & Premium Liquid Gold Chrome (LIVE & VERIFIED ON LDPLAYER):
  Ported exact website animations and visual effects into `components/effects/`:
  - **Charizard Fire Showcase** (`55b671e1-b9b5-4109-acc7-73f7b61b7d0f`): dual counter-rotating fire border rings,
    flickering flame glow aura, rising drifting embers, animated fire-gradient price underline, plus rainbow
    holographic foil, specular sweep, and touch-drag 3D tilt on product detail.
  - **Pikachu Electric Showcase** (`2ca26369-62b9-4b6e-a814-b2f2659b6228`): spinning gold/white/cyan electric
    ring, lightning-surge flicker glow, zapping SVG lightning bolts, twinkling sparkles, electric holo foil,
    animated yellow zig-zag lightning price underline, and touch-drag 3D tilt on product detail.
  - **Featured Stores Marquee Carousel**: seamless infinite auto-scrolling horizontal carousel (40 px/s) on Home
    and Explore (Stores tab) with left/right edge fade masks, floating Pause/Play button, manual swipe pause/resume,
    and Reduce Motion support.
  - **Premium Liquid Gold Chrome**: animated molten-gold border frames (`PremiumGoldFrame`) on Premium store cards,
    product cards, Store Detail header, and Product Detail store card; metallic gold `✦ Premium` pills
    (`PremiumChromePill`); flowing molten-gold surfaces (`LiquidGoldSurface`), pulsing/shining Upgrade CTA
    (`PremiumUpgradeButton`), and Welcome-to-Premium spark-burst celebration modal (`WelcomePremiumCelebration`)
    in Seller Dashboard (`SubscriptionTab`, `store.tsx`).
  - **Animated Awning Splash (`AppSplash.tsx`)**: mirrors website's sequential 5-scallop drop-in (`pt-drop`), pole
    grow (`pt-grow`), base pop (`pt-pop`), and wordmark/tagline rise (`pt-rise`).

### Not yet verified on device (needs non-admin / test writes)
- Register → email code → auto sign-in; new-Google-user role choice; restricted-account screen;
  submitting live reports / support tickets / ticket replies; completing live demo payments (Premium upgrade,
  Featured Store promo, bulk unlock, paid single/bulk product add); uploading/removing live avatar photo;
  live 72h countdown on an active `READY_FOR_PICKUP` order; realtime toast trigger on a newly inserted advisory;
  admin write mutations (moderating accounts, changing report/ticket status, hiding listings, editing LGU caps,
  restoring suspended store, reviewing business_documents); destructive Settings actions (deleting live account
  or store, changing live account password); server-triggered FCM broadcast from `send-push-notification` while
  app is force-closed (once `docs/send-fcm-push-reference.ts` is deployed in the Edge Function).

---

## 8. Roadmap (remaining work, in order)

All 6 planned feature batches (Batches 1–6) are complete and installed on LDPlayer!
Full gap analysis: see `docs/feature_gap_report.md`.

### Optional server-side FCM broadcast hookup
To push global advisories to closed Android devices from Supabase:
1. Ensure `FIREBASE_SERVICE_ACCOUNT_JSON` secret is set in Supabase Edge Function secrets (rotate the key in
   Firebase Console if previously shared in chat).
2. Wire `docs/send-fcm-push-reference.ts` into the deployed `send-push-notification` Edge Function to also send
   to `public.mobile_push_tokens`.

### Later / nice-to-have
- Move native patches into a config plugin; release signing keystore (currently release uses debug key);
  Play Store listing; iOS build (needs a Mac or EAS); dark mode; offline caching.
