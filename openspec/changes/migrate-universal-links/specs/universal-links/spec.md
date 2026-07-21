# Specification - Migrate Custom URL Scheme to Universal Links / App Links

## Requirements

1. **Domain Isolation**:
   - Staging must use `sonora-api-staging.sonora-api.workers.dev`.
   - Production must use `sonora-api.sonora-api.workers.dev`.

2. **Server-Side Verification Files**:
   - Serve the iOS Universal Link verification file at `/.well-known/apple-app-site-association` via Hono API.
   - Serve the Android App Link verification file at `/.well-known/assetlinks.json` via Hono API.

3. **Expo Configuration**:
   - Configure Universal Links under `ios.associatedDomains` (e.g. `applinks:sonora.app` and `applinks:staging.sonora.app`).
   - Configure App Links under `android.intentFilters` for both domains.

4. **Web Version Compatibility**:
   - Ensure the web version continues to function properly by validating the scheme and using regular browser routing.

## Android App Links Security (sha256CertFingerprints)

- **What**: The `sha256CertFingerprints` array contains the cryptographic SHA-256 fingerprint of the signing certificate used to build the Android application.
- **Why**: Google's Digital Asset Links protocol requires this fingerprint to verify that the domain of the backend API (`sonora-api.workers.dev` or `sonora.app`) grants linking permission exclusively to the authentic Android app. This prevents unauthorized apps from hijacking the `https://sonora.app/payment/*` URLs.
- **How**:
  - The fingerprints are defined in `@sonora/shared/config.ts` for both staging and production environments.
  - The Hono API reads these values and serves them in `/.well-known/assetlinks.json`.
  - The Android operating system retrieves the file, matches the installed app's signature, and enables the App Links securely.

## iOS Universal Links Security (AASA)

- **What**: The Apple App Site Association (AASA) file establishes a secure association between the domain (`sonora-api.workers.dev` or `sonora.app`) and the native iOS app.
- **Why**: Standard custom URL schemes (`sonora://`) can be hijacked. Universal Links are validated by iOS by fetching the AASA file from the server, ensuring only the official application with the matching Apple Team ID and bundle identifier can intercept the `https` URLs.
- **How**:
  - The API router serves the AASA JSON at `/.well-known/apple-app-site-association` containing the correct Apple `teamId` and `appId` values loaded from `@sonora/shared/config.ts`.
  - The mobile app's `associatedDomains` in `app.config.ts` lists the dynamic worker subdomains (e.g. `applinks:sonora-api.sonora-api.workers.dev`) based on the active build environment.
  - When the checkout session completes and redirects to the HTTPS domain, iOS intercepts the link and routes it back to the app.

## Web Version Compatibility

- **What**: When the checkout flow is completed from a web browser (desktop or mobile web build), the callback redirect handles browser-native routing.
- **Why**: Web apps run in a sandboxed browser context, not inside a native OS wrapper, so they cannot intercept Universal/App Links.
- **How**:
  - The `use-purchase.ts` hook detects the platform (`Platform.OS === 'web'`).
  - On web, it utilizes `Linking.createURL('')` to resolve to the current web origin (e.g. `http://localhost:19006` or `https://sonora.app`), skipping the HTTPS domain redirect so that the browser can handle the return natively.
