# PaliTrento Mobile — Native Push Notifications (Batch 6) Setup

The mobile app (`mobile`) already includes:
- 4 Android notification channels (`default`, `orders`, `messages`, `advisories`)
- Native Android system heads-up notifications on live advisories, order status changes, reservations, and chat messages
- Tap-to-open deep linking (foreground, background, and cold-start)
- Device badge syncing
- **Send test notification** button inside **Settings → Notifications**
- Automatic FCM token registration, rotation listener, and conditional Gradle `com.google.gms.google-services` hook

## Enable Background FCM Push (when the app is closed)

### 1. Create Firebase Android app & download `google-services.json`
1. Go to [Firebase Console](https://console.firebase.google.com) → Create or open your project.
2. Add an **Android** app with package name **`com.palitrento.mobile`**.
3. Download **`google-services.json`** and place it at:
   `mobile\google-services.json`
4. Rebuild the release APK:
   ```powershell
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
   cd mobile\android
   .\gradlew.bat assembleRelease
   ```
   `android/app/build.gradle` automatically copies `mobile\google-services.json` into `android/app/` and applies `com.google.gms.google-services` with no manual edits.

### 2. Create the `mobile_push_tokens` table in Supabase
Run [batch6-mobile-push-migration.sql](./batch6-mobile-push-migration.sql) in the Supabase SQL Editor.
- Keeps the website's Web Push `push_subscriptions` table untouched.
- As soon as a user opens the app with Push enabled, their Android FCM token syncs automatically to `mobile_push_tokens`.

### 3. (Optional) Send FCM pushes from Supabase Edge Functions
1. In Firebase Console → **Project Settings → Service accounts → Generate new private key**.
2. Save the JSON contents as a Supabase Edge Function secret named `FIREBASE_SERVICE_ACCOUNT_JSON`.
3. Copy the helper in [send-fcm-push-reference.ts](./send-fcm-push-reference.ts) into your `send-push-notification` Edge Function to deliver background FCM broadcasts alongside Web Push.
