# PaliTrento: website vs. mobile app gap report

I compared all 38 website pages (and the database tables and functions they use) with the React Native app in `mobile`.

**Legend:** ✅ in the app · ⚠️ partly in the app · ❌ missing

## 1. Customers

| Website feature | App | Notes |
|---|---|---|
| Home, featured stores, Bantay Presyo, nearby stores | ✅ | |
| Explore stores and products, filters | ⚠️ | The website ranks results with `search_stores_with_priority` / `search_products_with_priority` so Premium stores come first. The app only filters locally. |
| Map | ✅ | |
| Store page | ⚠️ | The **Report Business** button is missing. |
| Product page and reserving | ⚠️ | Missing: **Report Product**, the "You may also like" list, and hiding **locked products** (`product_lock_states`). |
| My Orders | ⚠️ | The website shows a **live 72-hour pickup countdown**. The app only shows the deadline date. |
| Order chat | ✅ | |
| **Notification bell / inbox** (`/advisories/`) | ❌ | No inbox for advisories, reservation alerts, order status changes, or chat messages. The website uses `notification_reads`, `notification_dismissals`, `reservation_notifications`, and `order_status_notifications`. |
| **Live pop-up alerts** (new advisory, order status changed) | ❌ | |
| **Report a business / product** | ❌ | `create_business_report`, `create_product_report` |
| **Help & Support tickets** | ❌ | `support_tickets`, `support_messages`, `create_support_ticket`, `add_support_message` |

## 2. Accounts and sign-in

| Website feature | App | Notes |
|---|---|---|
| Log in, register, forgot password | ✅ | |
| **Email verification code (OTP)** (`/verify/`) | ❌ | The app shows a simple "check your email" message instead. |
| **Choose account type after Google sign-in** | ❌ | `complete_google_account_registration`: new Google users never choose Customer or Business owner. |
| **Suspended / banned account screens** (`/auth-status/`) | ❌ | Restricted users aren't blocked or told why. There's also no `auto_restore_expired_suspensions` check. |
| **Password strength meter** | ❌ | |
| **Terms and Agreement** | ❌ | It's not linked from Register either. |
| Profile: avatar **photo upload** | ❌ | `avatars` storage. The app shows the photo but can't change it. |
| Settings: Profile, Security | ✅ | |
| Settings: **Notifications** preferences | ❌ | `notification_preferences` |
| Settings: **Privacy** | ❌ | |
| Settings: **Danger zone** (delete account) | ❌ | |
| Push notifications (actually receiving them) | ❌ | The website uses web push. The app needs native push (Firebase) and has only the permission prompt. |

## 3. Business owners

| Website feature | App | Notes |
|---|---|---|
| Orders: confirm, mark ready, complete, cancel with reason | ✅ | |
| Products: add, edit, delete with photos | ✅ | |
| Store setup and edit with permits | ✅ | |
| Basic analytics (orders, revenue, products) | ⚠️ | The app has 4 stats. The website's Analytics tab is fuller. |
| **Verification tab** (`business_compliance`, `acknowledge_business_approval`) | ❌ | |
| **Subscription / Premium upgrade** | ❌ | Plan card and upgrade via `verify_payment_and_activate_subscription` (demo QR payment). |
| **Featured store promo** | ❌ | `verify_payment_and_create_featured_promo` |
| **Locked products and unlocking** | ❌ | `verify_payment_and_unlock_products`, used when a free plan exceeds its quota. |
| **Bulk add products** | ❌ | |
| **Standee / QR code PDF** (`/standee/`) | ❌ | Printable QR poster for the store. |
| Premium visual frames on cards | ⚠️ | The app has a Premium badge, but not the website's animated "liquid chrome" frames. |

## 4. Admin

| Website page | App | Notes |
|---|---|---|
| Admin dashboard overview | ✅ | |
| Store verification (permits, approve, clarify, decline) | ✅ | |
| Price advisories (send and history) | ✅ | |
| Restore suspended store | ❌ | |
| **Accounts** (suspend / ban / restore users) | ❌ | `account_moderation_actions` |
| **Activity log** | ❌ | `audit_logs` |
| **Marketplace** (hide or remove stores and products) | ❌ | |
| **Pickup no-show cases** | ❌ | `pickup_no_show_cases` |
| **Reports overview** (stats by category and barangay) | ❌ | |
| **Reports management** (business and product reports) | ❌ | `business_reports`, `product_reports`, `admin_update_report_status` |
| **Support inbox** (reply to tickets) | ❌ | `admin_update_ticket_status` |
| **Verification documents** | ❌ | `business_documents`, `admin_review_business_document` |
| Set LGU price cap on products | ⚠️ | It's in the product form, but there's no admin screen to edit caps on any store's products. |

## Suggested order (biggest impact first)

1. **Safety and trust:** suspended/banned screens, the Google account-type step, and email verification code.
2. **Customer essentials:** notification inbox, live alerts, report business/product, support tickets, pickup countdown, locked-product hiding, related products.
3. **Seller business tools:** Premium subscription, locked products, featured promo, bulk add, Verification tab, QR standee, and avatar upload.
4. **Admin tools:** accounts moderation, reports management, support inbox, marketplace, pickup cases, activity log, reports overview, documents.
5. **Settings:** notification preferences, privacy, delete account, password meter, terms.
6. **Native push notifications:** needs a Firebase project, so it requires your setup.
