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
