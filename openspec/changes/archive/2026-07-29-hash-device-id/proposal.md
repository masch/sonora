# Hash device ID in mobile client + add `x-device-platform` header

## Quick path

1. Add `expo-crypto` dependency to `apps/mobile` and expose SHA-256 hashing in `packages/shared`
2. Hash the raw platform device ID on the client BEFORE it leaves the device
3. Add `x-device-platform` header (`ios`/`android`/`web`) to all mobile API requests
4. Update backend `injectDeviceId` middleware to stop double-hashing; validate incoming value (non-empty, ≤ 256 chars) and use as-is
5. Add `x-device-platform` to CORS allowed headers
6. Persist `platform` from the new header into `experienceAccesses` and `purchases` tables
7. One-time migration to SHA-256 any existing raw device IDs in the DB (safety net)

## Business problem and product outcome

**Problem**: The mobile app sends raw platform device identifiers (Android ID / iOS vendor ID) as the `X-Device-Id` header. These are stable, long-lived identifiers that could be used to track users across sessions or correlate activity — they leave the device in cleartext over every API call. This is a privacy smell: the backend hashes them on arrival, but the raw value is already exposed on the wire. Additionally, the backend has no way to know which platform a request comes from without inspecting User-Agent heuristics.

**Outcome**: Raw device IDs never leave the device — they're SHA-256 hashed client-side before any network request. The backend also receives a reliable `x-device-platform` header to log and persist for access analytics and debugging.

## Current-state gap

| Area                   | Current                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mobile → Network**   | Raw Android ID (`getAndroidId`), iOS vendor ID (`getIosIdForVendorAsync`), or fallback UUID sent as `X-Device-Id`                                                                                       |
| **Backend handling**   | Server hashes the raw value with SHA-256 in `injectDeviceId` middleware, stores the hash                                                                                                                |
| **Platform awareness** | No `x-device-platform` header sent by the mobile client. The `LogAccessBodySchema` _does_ accept an optional `platform` field, but it's only populated from the request body, not from a header         |
| **Database**           | `experienceAccesses.platform` column already exists (`platformEnum`) but is only populated from the request body in `POST /payments/experiences/:id/access`. `purchases` table has no `platform` column |
| **CORS**               | `X-Device-Id` is in the allowed headers list; `X-Device-Platform` is not                                                                                                                                |
| **Client hashing**     | No SHA-256 utility exists in the mobile app or shared package                                                                                                                                           |

## Proposed changes

### 1. Add SHA-256 hashing to the mobile client

Add `expo-crypto` as a dependency (not currently in the project). Create a shared SHA-256 utility in `packages/shared` (so the backend can also use it, replacing the current `hashDeviceId` inline implementation). The mobile `DeviceService.getPlatformDeviceId()` will hash the raw device ID before returning it, OR a new function `getHashedDeviceId()` will wrap the raw value.

Where the device ID is consumed (`api-client.ts`, `download-manager-store.ts`), the already-hashed value is sent as `X-Device-Id`.

### 2. Send `x-device-platform` header

The `MobileApiClient.getAuthHeader()` and `fetchWithDeviceId()` will also include an `X-Device-Platform` header with one of `ios`, `android`, `web` (determined at runtime via `Platform.OS` in React Native or a user-agent check on web).

### 3. Backend: stop double-hashing, validate the incoming value

The `injectDeviceId` middleware currently hashes the raw value. Once the client sends pre-hashed values, the server must NOT hash again — otherwise the stored hash won't match existing DB records (which already contain SHA-256 hashes from the current middleware).

**New `injectDeviceId` behavior:**

- Read `X-Device-Id` header
- Validate: non-empty, ≤ 256 characters (reject with 400 `INVALID_DEVICE_ID` otherwise)
- Set `c.var.deviceId` to the received value as-is (already hashed by the client)
- Read `X-Device-Platform` header (optional)
- Validate against `['ios', 'android', 'web']` if present
- Set `c.var.devicePlatform` (new variable)

**Migration compatibility**: Since the current middleware already hashes on the server side, ALL existing DB records contain SHA-256 hashes. New clients sending pre-hashed values will produce the same hash → existing records match. Old clients that haven't updated will send raw values → stored as-is (no longer hashed). A one-time migration (see below) handles stragglers.

### 4. Persist `platform` in the database

- **`experienceAccesses`**: Already has a `platform` column (existing). The route handler at `POST /payments/experiences/:id/access` already receives `platform` from the request body. Add `platform` also from the `x-device-platform` header (header takes precedence or body is removed in favor of header).
- **`purchases`**: Does NOT have a `platform` column. Add it (nullable `text` or `platformEnum`).
- On payment creation (`POST /payments/create`), persist the platform from the header.

### 5. CORS: Add `x-device-platform` to allowed headers

Add `'X-Device-Platform'` to the `DEFAULT_HEADERS` array in `apps/api/src/middleware/cors.ts`.

### 6. DB migration (safety net)

A one-time migration script to identify and SHA-256 hash any device IDs in `purchases` and `experienceAccesses` that don't look like SHA-256 hashes (non-64-char hex strings). This covers any records that might have been stored before the original hashing middleware was deployed, or from old clients after this deployment.

## Target users and scenarios

| Scenario                                | Impact                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| New user on iOS/Android/Web             | Device ID is hashed client-side before first API call. Platform is logged on access. |
| Existing user with purchased content    | Client-side hash matches the server-side hash already in the DB → no loss of access. |
| User on old app version (before update) | Sends raw device ID, server stores it raw. Migration script handles re-hashing.      |
| API client / download manager           | Both send hashed device ID + platform header transparently.                          |

## Platform scope

iOS, Android, and Web — all three platforms send `x-device-platform`. All three hash the device ID client-side before sending.

## First-slice scope boundaries and non-goals

| In scope                                                           | Out of scope                                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Client-side SHA-256 hashing of device ID                           | Server-side hashing removal (stays as safety net or is removed — decision in design phase) |
| `x-device-platform` header on all API requests                     | Platform detection via User-Agent parsing                                                  |
| CORS update for the new header                                     | Rate limiting by platform                                                                  |
| DB persistence of platform on `purchases` and `experienceAccesses` | Admin panel UI changes                                                                     |
| One-time migration script for existing device IDs                  | Removing `platform` from `LogAccessBodySchema` request body (can be done later)            |

## Security implications

| Concern                                     | Mitigation                                                                                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Raw device ID exposed on the wire**       | SHA-256 hashed client-side before any HTTPS request. The hash is irreversible; the raw value never transmitted.                                                            |
| **Client-side hashing ≠ server-side trust** | The server should still validate the format (length, non-empty). The server could still hash again for defense-in-depth (double-hash), but that breaks DB record matching. |
| **`expo-crypto` dependency**                | Uses the platform-native crypto API under the hood (CommonCrypto on iOS, android.security.keystore on Android, Web Crypto API on web). No custom crypto implementation.    |
| **Migration safety**                        | Read-only scan first, hash only records matching raw-ID patterns, dry-run option.                                                                                          |

## Migration compatibility

**Existing records**: Already contain SHA-256 hashes (the current middleware hashes on ingest). Client-side hashing of the same raw value produces the same hash → seamless continuity.

**Old clients (pre-update)**: Will send raw device IDs. After deployment, the server no longer hashes → raw values stored as-is. The migration script catches these and hashes them. **Risk window**: between deployment and migration script run, old-client records are raw. Mitigation: run migration immediately after backend deploy, before announcing the mobile update.

**Rollback**: If the mobile update is rolled back, old clients still work. If the backend is rolled back to the hashing middleware, already-hashed values from new clients will be double-hashed — those devices would lose access to purchases. **Rollback sequence**: revert mobile first, then revert backend.

## Implications and impact

| Area                   | Impact                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mobile API client**  | All outgoing requests now include `X-Device-Platform`; `X-Device-Id` value changes from raw to hash (same string length/complexity, no header size issues) |
| **Download manager**   | `fetchWithDeviceId` and download requests automatically include the hashed ID via `getDeviceId()` (unchanged call site)                                    |
| **Backend middleware** | `injectDeviceId` no longer hashes; validates and passes through. New `devicePlatform` variable added                                                       |
| **Backend routes**     | `experienceAccesses` route persists platform from header. Payment creation persists platform                                                               |
| **Existing DB data**   | Already hashed (no change). Migration script covers edge cases                                                                                             |
| **CORS preflight**     | Browsers (web client) will send OPTIONS with `x-device-platform` in `Access-Control-Request-Headers`. Must be allowed before web client breaks             |
| **Tests**              | All device-id middleware tests need updating (expected values change from double-hash to single-hash). API client tests need platform header assertion     |

## Risks and mitigations

| Risk                                                    | Likelihood | Impact            | Mitigation                                                                                                    |
| ------------------------------------------------------- | ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Old clients lose purchase access after backend deploy   | Medium     | High              | Migration script run immediately after backend deploy; deploy mobile update ASAP                              |
| Web client CORS preflight fails for `x-device-platform` | Low        | High (web broken) | Add header to CORS allowed list BEFORE or simultaneously with mobile deploy                                   |
| `expo-crypto` has different API on web vs native        | Low        | Medium            | Use the unified `expo-crypto` API (`digestStringAsync` with SHA-256); verify web polyfill                     |
| Double-hash during staggered rollout                    | Medium     | Medium            | Deploy backend change (remove hashing) first, then mobile update. Never both simultaneously in opposite order |

## Decision log

| Decision                                                  | Rationale                                                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Accept any non-empty string ≤ 256 chars** (not UUID v4) | Covers all device ID formats: Android 64-bit hex, iOS UUID v4, web UUID v4, fallback strings |
| **Send platform for all platforms**                       | Consistency; backend already has the enum and column                                         |
| **Persist platform in DB**                                | Access analytics, debugging, future platform-specific features                               |
| **One-time migration for existing IDs**                   | Safety net for any raw IDs stored before or during the transition                            |
| **`expo-crypto`**                                         | Native crypto APIs on all platforms; no custom crypto; already maintained by Expo            |
| **Remove server-side hashing**                            | Avoid double-hash inconsistency; client owns the privacy boundary                            |

## Success criteria

- [ ] Raw device ID is NOT present in any outgoing HTTP request header (verified via proxy/network inspector)
- [ ] SHA-256 hash of the device ID IS present as `X-Device-Id` on every API request
- [ ] `X-Device-Platform` header is present with correct value per platform
- [ ] Backend stores the platform value in both `experienceAccesses` and `purchases` tables
- [ ] CORS preflight for `x-device-platform` succeeds on web
- [ ] Existing users retain access to their purchases (hash matches DB records)
- [ ] All existing tests pass with updated expectations
- [ ] Migration script runs without data loss (dry-run output matches live-run result)
