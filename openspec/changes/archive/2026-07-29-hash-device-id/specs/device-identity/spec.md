# Device Identity Specification

## Purpose

Define how the Sonora client obtains, hashes, and transmits device identity information to the API. Device identity consists of a hashed device identifier (`X-Device-Id`) and a platform hint (`X-Device-Platform`). Raw platform device IDs (Android ID, iOS vendor ID) MUST NEVER leave the device in cleartext.

## Requirements

### Requirement: Client-side SHA-256 hashing of device ID

The mobile client MUST SHA-256 hash the raw platform device ID BEFORE it is transmitted over any network request. The hashing MUST happen inside `DeviceService.getPlatformDeviceId()` so that all downstream consumers (storage layer, API client, download manager) receive the already-hashed value transparently.

The SHA-256 hashing MUST use the `expo-crypto` package's `digestStringAsync` function with algorithm `SHA-256`. The output MUST be a lowercase hex-encoded string (64 characters).

`expo-crypto` MUST be added to `apps/mobile/package.json` dependencies.

#### Platform-specific raw ID sources

| Platform | Raw ID Source                                           | Notes                                                |
| -------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Android  | `expo-application.Application.getAndroidId()`           | Returns 64-bit hex string, or null if unavailable    |
| iOS      | `expo-application.Application.getIosIdForVendorAsync()` | Returns UUID string, or null if unavailable          |
| Web      | Persisted UUID in `localStorage` under `DEVICE_ID_KEY`  | Falls back to `generateUuid()` from `@sonora/shared` |

#### Fallback behavior

If all platform-specific ID sources return `null`/`undefined` (e.g. simulator, restricted permissions), `DeviceService.getPlatformDeviceId()` MUST generate a UUID via `generateUuid()` from `@sonora/shared`, persist it to platform storage (SQLite on native, `localStorage` on web), and hash that UUID.

#### Scenario: Android device ID is hashed before return

- GIVEN `Platform.OS` is `'android'`
- AND `Application.getAndroidId()` returns `"d6a66d9d0351085d"`
- WHEN `DeviceService.getPlatformDeviceId()` is called
- THEN `expo-crypto`'s `digestStringAsync` is called with algorithm `SHA-256` and the raw value `"d6a66d9d0351085d"`
- AND the returned value is the 64-character lowercase hex SHA-256 digest of the raw Android ID
- AND the raw Android ID is NOT stored in any property, variable, or closure accessible outside the function

#### Scenario: iOS vendor ID is hashed before return

- GIVEN `Platform.OS` is `'ios'`
- AND `Application.getIosIdForVendorAsync()` returns `"a23baa7e-2c82-472f-9241-4f23e00c1732"`
- WHEN `DeviceService.getPlatformDeviceId()` is called
- THEN the returned value is the SHA-256 hash of the iOS vendor ID
- AND the raw vendor ID is never exposed outside the function

#### Scenario: Web device ID is hashed before return

- GIVEN `Platform.OS` is `'web'`
- AND `localStorage.getItem(DEVICE_ID_KEY)` returns `"550e8400-e29b-41d4-a716-446655440000"`
- WHEN `DeviceService.getPlatformDeviceId()` is called
- THEN the returned value is the SHA-256 hash of the UUID

#### Scenario: All platform IDs unavailable, fallback UUID is generated and hashed

- GIVEN `Platform.OS` is `'android'`
- AND `Application.getAndroidId()` returns `null`
- AND no persisted UUID exists in SQLite storage
- WHEN `DeviceService.getPlatformDeviceId()` is called
- THEN a new UUID is generated via `generateUuid()`
- AND it is persisted to SQLite under `DEVICE_ID_KEY`
- AND the returned value is the SHA-256 hash of that UUID

#### Scenario: Fallback is deterministic (same raw ID produces same hash)

- GIVEN `DeviceService.getPlatformDeviceId()` returns a hashed value for raw ID `X`
- WHEN `DeviceService.getPlatformDeviceId()` is called again with the same raw ID `X`
- THEN the returned value is identical to the first call

### Requirement: Shared SHA-256 utility

`packages/shared` MUST export a SHA-256 hashing function usable by both the mobile client and the backend API:

```typescript
// packages/shared/src/utils/sha256.ts
export async function sha256(value: string): Promise<string>;
```

This function MUST:

- Accept a plain string value.
- Return the SHA-256 hex digest (lowercase, 64 characters).
- Use the Web Crypto API `crypto.subtle.digest('SHA-256', ...)` when available (backend, web).
- On native mobile platforms (`expo-crypto`), the mobile `DeviceService` MAY use `expo-crypto` directly instead of this shared function, since `expo-crypto` uses native platform crypto APIs under the hood.

The shared function MUST be exported from `packages/shared/src/index.ts`.

```typescript
export * from './utils/sha256';
```

#### Scenario: sha256 produces correct digest

- GIVEN `sha256("test-device-123")` is called
- THEN it returns `"a6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca314058b"`
- AND the output is always 64 lowercase hex characters

#### Scenario: sha256 is deterministic

- GIVEN the same input string
- WHEN `sha256` is called twice
- THEN both calls return identical results

#### Scenario: Different inputs produce different digests

- GIVEN two different input strings
- WHEN `sha256` is called on each
- THEN the returned digests are different

### Requirement: `X-Device-Platform` header on all API requests

Every API request from the mobile client MUST include an `X-Device-Platform` header with one of the following string values:

| Platform         | Header Value |
| ---------------- | ------------ |
| iOS (native)     | `ios`        |
| Android (native) | `android`    |
| Web (browser)    | `web`        |

The header value MUST be determined at runtime using:

- **iOS/Android native**: `Platform.OS` from `react-native` — returns `'ios'` or `'android'`
- **Web**: Hardcoded as `'web'` (the web platform file `device-service.web.ts` serves web-specific code)

The header MUST be added in two places:

1. **`getAuthHeader()` in `MobileApiClient`** (`apps/mobile/src/services/api-client.ts`): All requests through `ApiClient.request()`, `ApiClient.get()`, `ApiClient.post()`, etc. already get headers from `getAuthHeader()`. Add `X-Device-Platform` to the returned headers object.

2. **`fetchWithDeviceId()` in `ApiClient`** (`apps/mobile/src/services/api-client.ts`): Explicit fetch calls used by `performWebDownload` in the download manager. Add `X-Device-Platform` header alongside the existing `X-Device-Id`.

#### Scenario: API client includes platform header

- GIVEN the mobile API sends a `POST /payments/create` request
- WHEN `MobileApiClient.getAuthHeader()` is called
- THEN the returned headers include `X-Device-Platform: ios` (or `android`/`web` matching the runtime platform)

#### Scenario: fetchWithDeviceId includes platform header

- GIVEN a download request via `ApiClient.fetchWithDeviceId(url, init)`
- WHEN the fetch is executed
- THEN the request includes both `X-Device-Id` and `X-Device-Platform` headers

#### Scenario: Platform header value matches enum

- GIVEN any API request from the mobile client
- WHEN the `X-Device-Platform` header is inspected
- THEN its value is exactly one of: `ios`, `android`, `web`

### Requirement: `expo-crypto` dependency

The `expo-crypto` package MUST be added to `apps/mobile/package.json` as a production dependency.

On native platforms (iOS, Android), `expo-crypto` uses:

- iOS: `CommonCrypto` (CC_SHA256)
- Android: `android.security.keystore` / platform crypto provider

On web, `expo-crypto` falls back to the Web Crypto API.

The hashing function usage in `DeviceService.getPlatformDeviceId()`:

```typescript
import * as Crypto from 'expo-crypto';

// Inside getPlatformDeviceId():
const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawDeviceId);
return hash;
```

`expo-crypto` is chosen because:

- Uses native platform crypto APIs (not a JS implementation)
- Maintained by Expo core team
- Consistent API across iOS, Android, and Web
- No additional native build configuration required

### Requirement: Call chain transparency

The call chain from storage to network MUST carry the hashed device ID without any intermediate transformation:

```
DeviceService.getPlatformDeviceId()
  └─ Hashes raw platform ID via expo-crypto SHA-256
  └─ Returns 64-char hex hash
       │
 app-storage-common.ts: getDeviceId()
  └─ Delegates to getPlatformDeviceId()
  └─ Returns already-hashed value
       │
 getAuthHeader() / fetchWithDeviceId()
  └─ Sends hash as X-Device-Id header
  └─ Also sends X-Device-Platform header
```

No code outside `DeviceService` MUST ever access or store the raw (unhashed) platform device ID.

#### Scenario: Raw device ID never in storage

- GIVEN any storage key in `appStorage` (SQLite or localStorage)
- WHEN the storage is inspected
- THEN no key contains a raw Android ID, iOS vendor ID, or plaintext UUID that was obtained from a platform API
- AND any persisted device ID is the SHA-256 hash or a fallback UUID that was generated by the app
