# Hash Device ID: Architecture and Design

**Outcome**: Raw platform device IDs never leave the device — they're SHA-256 hashed client-side. The backend receives a reliable `X-Device-Platform` header and persists it. Existing users keep access; the migration is safe and reversible.

**Scope**: `packages/shared`, `apps/mobile`, `apps/api`, `apps/api/migrations`

---

## 1. Module Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  apps/mobile                                               │
│  ┌─────────────────┐   ┌──────────────┐   ┌─────────────┐ │
│  │ DeviceService   │ → │ api-client   │ → │ Network     │ │
│  │ (hashes via     │   │ (getAuthHdr  │   │ (HTTP req)  │ │
│  │  expo-crypto)   │   │  + platform) │   │             │ │
│  └────────┬────────┘   └──────────────┘   └──────┬──────┘ │
│           │                                      │        │
│  ┌────────▼────────┐                             │        │
│  │ app-storage     │                             │        │
│  │ (getDeviceId →  │                             │        │
│  │  delegate)      │                             │        │
│  └─────────────────┘                             │        │
└──────────────────────────────────────────────────┼────────┘
                                                   │
         X-Device-Id: <sha256>                    │
         X-Device-Platform: ios|android|web        │
                                                   │
┌──────────────────────────────────────────────────┼────────┐
│  apps/api                                        │        │
│  ┌────────────────┐    ┌──────────────────┐      │        │
│  │ CORS           │    │ injectDeviceId    │ ◄────┘        │
│  │ (allows header)│    │ (NO hashing,      │                │
│  └────────────────┘    │  validates,       │                │
│                        │  sets deviceId +  │                │
│  ┌─────────────────┐   │  devicePlatform)  │                │
│  │ routes/payments  │   └────────┬─────────┘                │
│  │ - persist platf  │            │                          │
│  │   on purchase    │            │ c.var.deviceId            │
│  │ - persist platf  │            │ c.var.devicePlatform      │
│  │   on access      │            ▼                          │
│  │ (header > body)  │   ┌──────────────────┐                │
│  └────────┬─────────┘   │ DB schema        │                │
│           │             │ purchases:       │                │
│           ▼             │   +platform text │                │
│  ┌──────────────────┐   │   NOT NULL       │                │
│  │ DB (Postgres)    │   │ experienceAccess │                │
│  │ purchases        │   │   (exists)       │                │
│  │ +platform column │   └──────────────────┘                │
│  │ experienceAccess │                                        │
│  │ (platform exists)│                                        │
│  └──────────────────┘                                        │
└──────────────────────────────────────────────────────────────┘

packages/shared
  ┌────────────────────────────────────────────┐
  │ utils/sha256.ts (NEW)                      │
  │ export async function sha256(v: string)    │
  │   → Promise<string>                        │
  │ Uses Web Crypto API. Exported from index. │
  └────────────────────────────────────────────┘
```

### Dependency flow

```
packages/shared ← apps/mobile (expo-crypto for native, shared for web)
packages/shared ← apps/api (Web Crypto via sha256 utility)
```

The shared `sha256` utility uses the Web Crypto API (`crypto.subtle.digest`). On native mobile, `DeviceService` uses `expo-crypto` directly (native CommonCrypto / Android Keystore). On web (mobile or standalone), `DeviceService` could use the shared utility. The backend's migration script uses the shared utility (runs in Node/Bun with Web Crypto).

### Why two hashing paths?

`expo-crypto` uses native platform crypto on iOS/Android (CommonCrypto, Android Keystore). The Web Crypto API works in browsers and Bun. Both produce identical SHA-256 hex output for the same input — they're the same algorithm. The shared utility exists for the backend and web clients; `expo-crypto` is for native mobile.

---

## 2. Data Flow

### 2.1 Device ID: raw → hash → network → backend → DB

```
┌─ Device ───────────────────────────────────────────────────┐
│                                                             │
│  1. getPlatformDeviceId() called                            │
│     │                                                       │
│     ├─ Platform.OS === 'android'                            │
│     │   └─ Application.getAndroidId() → "d6a66d9d..."      │
│     │                                                       │
│     ├─ Platform.OS === 'ios'                                │
│     │   └─ getIosIdForVendorAsync() → "a23baa7e-..."       │
│     │                                                       │
│     └─ Platform.OS === 'web'                                │
│         └─ localStorage → UUID or generateUuid()            │
│                                                             │
│  2. raw ID → Crypto.digestStringAsync(SHA-256, raw)         │
│     → 64-char lowercase hex hash                            │
│     → returned (raw ID NOT stored/exposed)                  │
│                                                             │
│  3. getDeviceId() → same hash (delegates)                   │
│                                                             │
│  4. getAuthHeader() → { X-Device-Id: <hash>,               │
│                         X-Device-Platform: "ios" }          │
│                                                             │
│  5. fetchWithDeviceId() → same headers                      │
│                                                             │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─ Backend ───────────────────────────────────────────────────┐
│                                                             │
│  6. injectDeviceId middleware:                              │
│     ├─ Read X-Device-Id header                              │
│     ├─ Validate: non-empty, ≤256 chars                       │
│     ├─ Set c.var.deviceId = value (as-is, NO hashing)       │
│     ├─ Read X-Device-Platform header                        │
│     ├─ Validate: ['ios','android','web']                     │
│     └─ Set c.var.devicePlatform = value (or undefined)      │
│                                                             │
│  7. Route handler:                                          │
│     ├─ POST /payments/create                                │
│     │   └─ inserts purchases.platform = devicePlatform      │
│     │      or 'unknown' when absent                         │
│     └─ POST /experiences/:id/access                         │
│         └─ inserts platform = header (wins) > body          │
│                                                             │
│  8. DB:                                                     │
│     └─ purchases.platform = "ios"                           │
│     └─ experienceAccesses.platform = "ios"                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Fallback path (when no platform ID available)

```
getPlatformDeviceId()
  └─ Platform ID source returns null
  └─ SQLite.getItem(DEVICE_ID_KEY) → null
  └─ generateUuid() → new UUID
  └─ SQLite.setItem(DEVICE_ID_KEY, UUID)
  └─ Crypto.digestStringAsync(SHA-256, UUID)
  └─ return hash(UUID)
```

### 2.3 Migration script flow

```
migrate-device-ids.ts
  ┌─ Connect to DB
  ├─ SELECT device_id FROM purchases
  ├─ SELECT device_id FROM experience_accesses
  ├─ For each value:
  │   ├─ NULL → skip (count as nullRows)
  │   ├─ matches /^[0-9a-f]{64}$/i → skip (count as alreadyHashed)
  │   └─ else → SHA-256 hash → queue UPDATE
  ├─ If --dry-run: log what would change
  ├─ Else: UPDATE in transaction
  └─ Log report
```

---

## 3. Component Responsibilities

| Layer                         | Owns                                                                                                      | Does NOT own                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **DeviceService** (mobile)    | Raw platform ID retrieval, SHA-256 hashing via `expo-crypto`, fallback UUID generation & persistence      | Network transmission, storage of hashed value beyond function return |
| **app-storage-common**        | Calling `getPlatformDeviceId()`, returning value to consumers                                             | Hashing, raw ID handling                                             |
| **api-client** (mobile)       | Sending `X-Device-Id` + `X-Device-Platform` headers on every request                                      | Hashing, device ID retrieval (delegates to storage → DeviceService)  |
| **packages/shared/sha256**    | SHA-256 via Web Crypto API (for backend, web clients)                                                     | Platform ID retrieval, network, storage                              |
| **injectDeviceId** (backend)  | Validation of incoming `X-Device-Id`, pass-through (NO hash), `X-Device-Platform` extraction & validation | DB persistence, rate limiting, route-specific guards                 |
| **deviceIdGuard** (backend)   | Rejecting requests with no `deviceId` set                                                                 | Hashing, validation format                                           |
| **payments router** (backend) | Persisting `devicePlatform` from middleware into DB on purchase/access creation                           | Header parsing, ID validation                                        |
| **CORS middleware**           | Allowing `X-Device-Platform` in preflight response                                                        | Header content, validation                                           |
| **Migration script**          | SHA-256 hashing existing raw device IDs in DB (one-time)                                                  | Ongoing middleware behavior, route logic                             |

---

## 4. File-by-File Change Plan

### 4.1 `packages/shared/src/utils/sha256.ts` (NEW)

```typescript
/**
 * SHA-256 hash a string value.
 * Uses Web Crypto API (available in modern browsers, Bun, Node.js).
 * Returns lowercase 64-character hex digest.
 */
export async function sha256(value: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
```

Same implementation as the current `hashDeviceId` in `apps/api/src/middleware/device-id.ts`. The backend function stays exported for backward compat but the shared utility is the canonical version.

### 4.2 `packages/shared/src/index.ts` (EDIT)

Add export line:

```typescript
export * from './utils/sha256';
```

### 4.3 `apps/mobile/package.json` (EDIT)

Add to `dependencies`:

```json
"expo-crypto": "~14.1.0"
```

(Version matches Expo SDK 56 compatibility — verify exact version)

### 4.4 `apps/mobile/src/services/device-service.ts` (EDIT)

**Changes**:

1. Import `* as Crypto from 'expo-crypto'`
2. After getting raw device ID, hash it before returning
3. Raw ID is never stored or exposed

```typescript
import SqliteStorage from 'expo-sqlite/kv-store';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { DEVICE_ID_KEY, generateUuid } from '@sonora/shared';

export const DeviceService = {
  async getPlatformDeviceId(): Promise<string> {
    try {
      let rawDeviceId: string | null = null;
      if (Platform.OS === 'android') {
        rawDeviceId = Application.getAndroidId();
      } else if (Platform.OS === 'ios') {
        rawDeviceId = await Application.getIosIdForVendorAsync();
      }

      if (!rawDeviceId) {
        rawDeviceId = await SqliteStorage.getItem(DEVICE_ID_KEY);
        if (!rawDeviceId) {
          rawDeviceId = generateUuid();
          await SqliteStorage.setItem(DEVICE_ID_KEY, rawDeviceId);
        }
      }

      // SHA-256 hash the raw device ID before returning
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawDeviceId);
      return hash;
    } catch {
      return 'fallback-device-id';
    }
  },
};
```

### 4.5 `apps/mobile/src/services/device-service.web.ts` (EDIT)

Same pattern — hash before returning:

```typescript
import { DEVICE_ID_KEY, generateUuid, sha256 } from '@sonora/shared';
import { logger } from '@/utils/logger';

export const DeviceService = {
  async getPlatformDeviceId(): Promise<string> {
    try {
      let rawDeviceId = localStorage.getItem(DEVICE_ID_KEY);
      if (!rawDeviceId) {
        rawDeviceId = generateUuid();
        localStorage.setItem(DEVICE_ID_KEY, rawDeviceId);
      }

      const hash = await sha256(rawDeviceId);
      return hash;
    } catch (err) {
      logger.error('Failed to get web platform device ID', err);
      return 'fallback-web-device-id';
    }
  },
};
```

Uses `sha256` from `@sonora/shared` (Web Crypto API) since `expo-crypto` may not be the optimal path on web. If `expo-crypto` on web works well, could use it here too for consistency — decide during implementation. Both produce identical output.

### 4.6 `apps/mobile/src/services/api-client.ts` (EDIT)

**Two changes**:

1. **`getAuthHeader()`**: Add `X-Device-Platform` header
2. **`fetchWithDeviceId()`**: Add `X-Device-Platform` header

```typescript
import { Platform } from 'react-native';

class MobileApiClient extends BaseApiClient {
  protected override async getAuthHeader(): Promise<Record<string, string>> {
    const deviceId = await getDeviceId();
    if (!deviceId) {
      const err = new Error('Mandatory X-Device-Id is missing in client storage');
      logger.error('Failed to retrieve device ID for API headers', err);
      throw err;
    }
    return {
      'X-Device-Id': deviceId,
      'X-Device-Platform': Platform.OS as string,
    };
  }
}
```

And in `fetchWithDeviceId()`:

```typescript
async fetchWithDeviceId(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const deviceId = await getDeviceId();
  if (!deviceId) {
    throw new Error('Mandatory X-Device-Id is missing in client storage');
  }
  const headers = new Headers(init.headers || {});
  headers.set('X-Device-Id', deviceId);
  headers.set('X-Device-Platform', Platform.OS as string);

  return fetch(input, {
    ...init,
    headers,
  });
},
```

**Note for web**: On web, `Platform.OS` from `react-native` returns `'web'`. The React Native web polyfill handles this. If the web client uses a different code path, ensure `'web'` is hardcoded appropriately.

### 4.7 `apps/api/src/index.ts` (EDIT)

Add `devicePlatform` to the `Variables` interface:

```typescript
export interface Variables {
  db: DbClient;
  deviceId: string;
  devicePlatform?: 'ios' | 'android' | 'web'; // ADDED
  privateBucket: R2Bucket;
  // ... rest unchanged
}
```

Keep `export { hashDeviceId }` — it's used by tests and the migration script.

### 4.8 `apps/api/src/middleware/cors.ts` (EDIT)

Add `'X-Device-Platform'` to `DEFAULT_HEADERS`:

```typescript
const DEFAULT_HEADERS = [
  'Content-Type',
  'Authorization',
  'Range',
  'Cache-Control',
  'Pragma',
  'X-Device-Id',
  'X-Device-Platform', // ADDED
  'X-Signature',
  'X-Timestamp',
  'X-Nonce',
  'Retry-After',
];
```

### 4.9 `apps/api/src/middleware/device-id.ts` (Major rewrite)

**Changes**:

1. Remove `hashDeviceId()` (canonical version in `packages/shared` — keep export for backward compat)
2. Remove hashing call in middleware
3. Add `X-Device-Platform` header parsing and validation
4. Set `c.var.devicePlatform`

```typescript
import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';

// Keep exported for backward compat (tests, migration script)
export async function hashDeviceId(deviceId: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(deviceId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

const VALID_PLATFORMS = ['ios', 'android', 'web'] as const;

export const injectDeviceId = (): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> => {
  return async (c, next) => {
    const rawDeviceId = c.req.header('X-Device-Id');
    if (rawDeviceId !== undefined) {
      if (rawDeviceId.length === 0) {
        return c.json(
          {
            code: 'INVALID_DEVICE_ID',
            detail: 'The X-Device-Id header must not be empty.',
            status: 400,
          },
          400,
        );
      }
      if (rawDeviceId.trim().length === 0) {
        return c.json(
          {
            code: 'INVALID_DEVICE_ID',
            detail: 'The X-Device-Id header must not be empty.',
            status: 400,
          },
          400,
        );
      }
      if (rawDeviceId.length > 256) {
        return c.json(
          {
            code: 'INVALID_DEVICE_ID',
            detail: 'The X-Device-Id header must be 256 characters or fewer.',
            status: 400,
          },
          400,
        );
      }

      // PASSTHROUGH — client sent pre-hashed value, do NOT hash again
      c.set('deviceId', rawDeviceId);
    }

    // X-Device-Platform handling
    const platformHeader = c.req.header('X-Device-Platform');
    if (platformHeader !== undefined) {
      if (VALID_PLATFORMS.includes(platformHeader as (typeof VALID_PLATFORMS)[number])) {
        c.set('devicePlatform', platformHeader as 'ios' | 'android' | 'web');
      }
      // Invalid values silently ignored
    }

    await next();
  };
};
```

### 4.10 `apps/api/src/db/schema.ts` (EDIT)

Add `platform` column to `purchases` table:

```typescript
export const purchases = sonoraSchema.table('purchases', {
  // ... existing columns
  platform: text('platform').notNull(), // ADDED — no .default(), application always provides value
  // ... existing columns (createdAt, updatedAt)
});
```

### 4.11 `apps/api/src/routes/payments.ts` (EDIT)

**Two changes**:

**a) POST /payments/create**: Add `platform` to insert values:

```typescript
const [purchase] = await db
  .insert(purchases)
  .values({
    experienceId: experience.id,
    provider: defaultProvider,
    providerPaymentId: `pending-${crypto.randomUUID()}`,
    amount: experience.price,
    currency: 'ARS',
    status: 'pending',
    metadata: redirectUrl ? { redirectUrl } : undefined,
    deviceId: c.var.deviceId,
    platform: c.var.devicePlatform ?? 'unknown', // ADDED
  })
  .returning();
```

**b) POST /experiences/:id/access**: Use header platform with body fallback:

```typescript
// Determine platform: header wins, fall back to body
const platform = c.var.devicePlatform ?? body.platform ?? null;

await db.insert(experienceAccesses).values({
  experienceId: id,
  email: body.email ?? null,
  deviceId,
  source: body.source,
  priceAtAccess: experience?.price ?? null,
  platform, // was: body.platform ?? null
});
```

### 4.12 `apps/api/migrations/` (NEW migration)

Generate with `bun run db:generate`, then edit the SQL:

```sql
-- Step 1: Add column with temporary default
ALTER TABLE sonora.purchases ADD COLUMN platform text NOT NULL DEFAULT 'android';

-- Step 2: Remove default — application always provides a value
ALTER TABLE sonora.purchases ALTER COLUMN platform DROP DEFAULT;
```

File naming convention follows existing migrations (e.g., `0005_*.sql` with `meta/0005_snapshot.json`).

### 4.13 `apps/api/scripts/migrate-device-ids.ts` (NEW)

```typescript
#!/usr/bin/env bun
/**
 * One-time migration: SHA-256 hash any raw (unhashed) device IDs in the database.
 *
 * Usage:
 *   bun run apps/api/scripts/migrate-device-ids.ts           # live run
 *   bun run apps/api/scripts/migrate-device-ids.ts --dry-run  # dry run
 */

import { sha256 } from '@sonora/shared';
// ... db connection, scan, update logic per spec
```

**Interface**:

```typescript
interface MigrationOptions {
  dryRun?: boolean;
  connectionString?: string;
}

interface MigrationResult {
  totalRows: number;
  rawRows: number;
  alreadyHashedRows: number;
  nullRows: number;
  updatedRows: number;
  errors: Array<{ row: unknown; error: string }>;
}
```

---

## 5. Dependency Graph

### Build/test/deploy order

```
1. packages/shared ────────────────────────┐
   └─ Add sha256 utility                   │
   └─ Export from index.ts                 │
   └─ TEST: unit test sha256()             │
                                          │
2. apps/api/migrations ────────────────────┤
   └─ Generate + edit migration SQL        │
   └─ Run DDL (ADD COLUMN platform)        │
                                          │
3. apps/api/scripts ───────────────────────┤
   └─ Create migrate-device-ids.ts         │ depends on (1) sha256
   └─ Run --dry-run → verify               │
   └─ Run live                             │
                                          │
4. apps/api ───────────────────────────────┤
   └─ Update middleware, CORS, routes      │ depends on (1) — no code dep but consistent
   └─ Update Variables interface           │
   └─ Update schema.ts                     │
   └─ TEST: device-id middleware, chain    │
   └─ Deploy                               │
                                          │
5. apps/mobile ────────────────────────────┤
   └─ Add expo-crypto dependency           │ depends on (1) for web, (2-4) for API compat
   └─ Update DeviceService (hash)          │
   └─ Update api-client (platform header)  │
   └─ TEST: device-service, api-client     │
   └─ Deploy (via EAS / store)             │
```

### Deployment ordering (critical)

| Step | Action                          | Risk if skipped                                  |
| ---- | ------------------------------- | ------------------------------------------------ |
| ①    | DDL migration (add column)      | Route fails inserting purchases                  |
| ②    | Data migration (hash raw IDs)   | Old-client raw IDs stored without hash           |
| ③    | Backend deploy (new middleware) | None — column exists, data is clean              |
| ④    | Mobile deploy (client hashing)  | Old clients still work (server validates format) |

### Rollback ordering

1. **Revert mobile first** — old clients send raw IDs, server stores them as-is (no double-hash).
2. **Revert backend second** — restoring hashing middleware. New clients' already-hashed values would be double-hashed. **Mitigation**: re-run migration script to hash any raw IDs stored during the window.

---

## 6. Interface Contracts

### 6.1 `packages/shared`

```typescript
// packages/shared/src/utils/sha256.ts
export async function sha256(value: string): Promise<string>;
// Input: any string
// Output: 64-char lowercase hex SHA-256 digest
// Uses: Web Crypto API (crypto.subtle.digest)
```

### 6.2 DeviceService (mobile)

```typescript
// apps/mobile/src/services/device-service.ts
export const DeviceService = {
  async getPlatformDeviceId(): Promise<string>;
  // Returns: SHA-256 hash of raw platform device ID or fallback UUID
  // Never returns the raw ID
  // Fallback: 'fallback-device-id' on error
};

// apps/mobile/src/services/device-service.web.ts
export const DeviceService = {
  async getPlatformDeviceId(): Promise<string>;
  // Returns: SHA-256 hash of localStorage UUID
  // Fallback: 'fallback-web-device-id' on error
};
```

### 6.3 API client headers (mobile)

```typescript
// getAuthHeader() returns:
{
  'X-Device-Id': string;           // 64-char hex SHA-256 hash
  'X-Device-Platform': string;     // 'ios' | 'android' | 'web'
}

// fetchWithDeviceId() adds these headers:
// X-Device-Id: <hash>
// X-Device-Platform: <platform>
```

### 6.4 Backend middleware

```typescript
// apps/api/src/middleware/device-id.ts

export async function hashDeviceId(deviceId: string): Promise<string>;
// Kept exported for backward compat. Same impl, used by tests + migration.

export const injectDeviceId = (): MiddlewareHandler<{ Bindings: Env; Variables: Variables }>;
// Behavior per spec — validates X-Device-Id, passes through, no hash.
// Reads X-Device-Platform, validates, sets c.var.devicePlatform.
```

### 6.5 Variables interface

```typescript
export interface Variables {
  // ... existing
  devicePlatform?: 'ios' | 'android' | 'web'; // NEW — set by injectDeviceId
}
```

### 6.6 Route handler behavior

```typescript
// POST /payments/create
// insert values: { ..., platform: c.var.devicePlatform ?? 'unknown' }

// POST /experiences/:id/access
// const platform = c.var.devicePlatform ?? body.platform ?? null;
// insert values: { ..., platform }
```

### 6.7 Migration script

```typescript
interface MigrationOptions {
  dryRun?: boolean;
  connectionString?: string;
}

interface MigrationResult {
  totalRows: number;
  rawRows: number;
  alreadyHashedRows: number;
  nullRows: number;
  updatedRows: number;
  errors: Array<{ row: unknown; error: string }>;
}
```

---

## 7. Testing Approach

### 7.1 packages/shared — new unit tests

| Test                                 | What it covers                 |
| ------------------------------------ | ------------------------------ |
| `sha256` produces correct digest     | Known input → known output     |
| `sha256` is deterministic            | Same input twice → same output |
| Different inputs → different digests | Collision resistance (basic)   |
| Empty string hashing                 | Edge case: `sha256("")`        |
| Unicode/non-ASCII input              | UTF-8 encoding consistency     |

### 7.2 apps/mobile — test updates

| Test file                    | Change                                                                                               | What it covers                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `device-service.test.ts`     | Update mocks to include `expo-crypto`, update expectations from raw ID → SHA-256 hash of that raw ID | Android, iOS, fallback paths all return hashed values |
| `device-service.web.test.ts` | Update mocks for `sha256` utility, assert returned value is hash not raw UUID                        | Web path returns hashed value                         |
| `api-client.test.ts`         | Add assertions for `X-Device-Platform` header in `getAuthHeader()` and `fetchWithDeviceId()`         | Both paths include correct platform header            |

**Key assertions to adjust**:

- `device-service.test.ts`: The test that expects `'mock-android-id'` must now expect `await hashDeviceId('mock-android-id')` (from `packages/shared` or the equivalent)
- All `api-client.test.ts` assertions about `X-Device-Id` value stay the same — `getDeviceId()` returns the hashed value transparently

### 7.3 apps/api — test updates

| Test file                           | Change                                                                                                                                                                                                                                                           | What it covers                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `device-id.test.ts`                 | Update `injectDeviceId` tests — `c.var.deviceId` is now the raw header value, NOT hashed                                                                                                                                                                         | New passthrough behavior; `hashDeviceId` unit tests stay unchanged |
| `security-middleware-chain.test.ts` | Update `rateLimitKey` helper — the rate limit key was previously computed from the hashed ID (from `c.var.deviceId`). After the change, `c.var.deviceId` is the raw header value passed through, so the rate limit key becomes predictable from the header value | Rate limiting still works                                          |

**Critical `security-middleware-chain.test.ts` note**:

The `rateLimitKey()` helper currently computes:

```typescript
const hashedDeviceId = await hashDeviceId(rawDeviceId);
```

After the change, `c.var.deviceId` is the raw header value (not hashed). So `rateLimitKey()` should be updated to NOT hash:

```typescript
async function rateLimitKey(
  prefix: string,
  rawDeviceId: string,
  windowSeconds: number,
): Promise<string> {
  // deviceId is now passthrough, NOT hashed
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  return `rate-limit:${prefix}:${rawDeviceId}:${windowStart}`;
}
```

**New tests to add for injectDeviceId**:

| Test                                              | Scenario                                       |
| ------------------------------------------------- | ---------------------------------------------- |
| Valid pre-hashed 64-char hex value passes through | Header value → c.var.deviceId = same value     |
| X-Device-Platform: ios sets devicePlatform        | Header → c.var.devicePlatform = 'ios'          |
| X-Device-Platform: windows is ignored             | Invalid value → devicePlatform stays undefined |
| Missing X-Device-Platform leaves undefined        | No header → no error, platform not set         |
| Both headers present                              | deviceId + devicePlatform both set correctly   |
| Platform header validation case-sensitivity       | 'iOS' (uppercase) → ignored                    |

### 7.4 Integration / E2E considerations

- Run full middleware chain test (`security-middleware-chain.test.ts`) with new middleware to verify rate limiting still works
- Web client CORS preflight: manual test with browser that OPTIONS request includes `x-device-platform` in `Access-Control-Request-Headers` and response allows it
- Migration script: test against a local DB copy with known raw IDs to verify detection and hashing

---

## 8. Risks and Mitigations

| Risk                                                  | Likelihood | Mitigation                                                                               |
| ----------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| Old clients lose purchase access after backend deploy | Medium     | Deploy migration script BEFORE backend change; deploy mobile ASAP                        |
| Web CORS preflight breaks                             | Low        | Add `X-Device-Platform` to CORS headers BEFORE or simultaneous with backend deploy       |
| `expo-crypto` API differs on web                      | Low        | Shared `sha256` utility uses Web Crypto; `DeviceService` uses expo-crypto on native only |
| Double-hash in staggered rollback                     | Low        | Document rollback order: mobile first, then backend                                      |

---

## 9. Acceptance Criteria Checklist

- [ ] `packages/shared` exports `sha256()` producing correct 64-char hex digests
- [ ] `DeviceService.getPlatformDeviceId()` returns SHA-256 hash (never raw ID)
- [ ] `api-client.ts` includes `X-Device-Platform` in `getAuthHeader()` and `fetchWithDeviceId()`
- [ ] `injectDeviceId` passes `X-Device-Id` through without hashing, validates format
- [ ] `injectDeviceId` extracts and validates `X-Device-Platform`, sets `c.var.devicePlatform`
- [ ] `c.var.devicePlatform` is `'ios'` | `'android'` | `'web'` when header valid; `undefined` otherwise
- [ ] CORS allows `X-Device-Platform` header
- [ ] `POST /payments/create` persists platform (`'unknown'` when absent)
- [ ] `POST /experiences/:id/access` persists platform (header > body > null)
- [ ] Migration script detects and hashes raw device IDs
- [ ] All existing tests pass with updated expectations
