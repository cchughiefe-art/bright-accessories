# Bright Accessories

Mobile-first ecommerce website and direct-download Android app for Bright Accessories.

## Customer experience

- Product catalogue with search, categories, sorting, saved products and stock visibility
- Customer accounts with email verification and password reset
- Account-required checkout with bank transfer receipt upload or cash on delivery
- Lagos delivery zones and nationwide shipping
- Order history, delivery timeline, cancellation while pending and one-tap reorder
- Order reference tracking and email confirmations
- Offline catalogue cache, installable web app and native APK update notices
- Responsive Cloudinary images and mobile app-style navigation

## Admin dashboard

- Revenue, profit, fulfilment and stock overview
- Product, price, inventory and Cloudinary image management
- Payment verification and order status workflow
- Order search and CSV export
- Editable bank, WhatsApp, announcement and delivery settings
- Editable APK version, download URL, release notes and compulsory-update controls

## Local development

```bash
npm ci
npm run dev
```

Quality checks:

```bash
npm run lint
npm run build
```

## Firebase setup

Enable Email/Password under Authentication, add `bright-accessories.vercel.app` to Authorized domains, and publish `firestore.rules`. Customer order access and cancellation will not work until the included rules are published.

Collections used: `products`, `orders`, `publicOrders`, and `settings/store`.

## Android releases

The APK package is `com.brightaccessories.store`. Signed release builds use `.github/workflows/android-release.yml` and require these GitHub Actions secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Tagging a version such as `v1.0.0` publishes `bright-accessories.apk` to the latest GitHub Release. Keep the signing key permanently because Android rejects updates signed with a different key.

For a new release, update the version in `package.json`, publish the tag, then change the APK version and release notes from Admin → Store settings.
