# Hash Device ID + X-Device-Platform — Implementation Tasks

## Review Workload Forecast

| Field                   | Value                                                             |
| ----------------------- | ----------------------------------------------------------------- |
| Estimated changed lines | 550–700                                                           |
| 400-line budget risk    | High                                                              |
| Chained PRs recommended | Yes                                                               |
| Suggested split         | PR 1 (backend) → PR 2 (mobile + shared) → PR 3 (migration script) |
| Delivery strategy       | ask-on-risk                                                       |
| Chain strategy          | stacked-to-main                                                   |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

## PR 1 — Backend: middleware, CORS, routes, schema (~200–250 lines)

### 1.1 Add `devicePlatform` to Variables interface

**Subject**: Add `devicePlatform` field to the Hono `Variables` interface

**Files affected**:

- `apps/api/src/index.ts`

**Acceptance criteria**:

- The `Variables` interface includes `devicePlatform?: 'ios' | 'android' | 'web'`
- Existing `deviceId: string` field remains unchanged
- No other Variables field is modified
- TypeScript compiles without errors

**Dependencies**: None

**Estimate**: Small (~5 lines changed)

**Test evidence required**: TypeScript compilation passes; no runtime test needed for this change alone.

---

### 1.2 Update `injectDeviceId` middleware — remove hashing, add platform extraction

**Subject**: Rewrite `injectDeviceId` to pass through `X-Device-Id` as-is and extract `X-Device-Platform`

**Files affected**:

- `apps/api/src/middleware/device-id.ts`

**Acceptance criteria**:

- `hashDeviceId()` function remains exported from the module (backward compat for tests and migration script)
- `injectDeviceId()` does NOT call `hashDeviceId()` — `c.var.deviceId` is set to the raw header value
- Empty string `X-Device-Id` returns 400 `INVALID_DEVICE_ID` with detail `"The X-Device-Id header must not be empty."`
- Whitespace-only `X-Device-Id` returns 400 `INVALID_DEVICE_ID`
- `X-Device-Id` > 256 characters returns 400 `INVALID_DEVICE_ID` with detail `"The X-Device-Id header must be 256 characters or fewer."`
- Missing `X-Device-Id` passes through without setting `deviceId` (downstream guard handles rejection)
- When `X-Device-Platform` header is present and one of `ios`, `android`, `web`, set `c.var.devicePlatform` to that value
- When `X-Device-Platform` value is invalid (e.g. `windows`, `iOS`), it is silently ignored — `devicePlatform` remains `undefined`
- When `X-Device-Platform` is missing, `devicePlatform` remains `undefined` — no error
- Both headers present simultaneously work correctly

**Dependencies**: 1.1 (Variables interface must have `devicePlatform`)

**Estimate**: Medium (~40 lines changed/added)

**Test evidence required**:

- `apps/api/src/__tests__/device-id.test.ts` updated to assert `c.var.deviceId` equals the raw header value (NOT the hash) for all valid inputs
- New test: valid 64-char hex value passes through unchanged
- New test: `X-Device-Platform: ios` sets `devicePlatform = 'ios'`
- New test: `X-Device-Platform: windows` is silently ignored
- New test: missing `X-Device-Platform` leaves `devicePlatform` undefined
- New test: both headers set correctly
- Empty / whitespace / length > 256 rejection tests remain but assertions unchanged
- `hashDeviceId` unit tests (determinism, known digest) remain unchanged

---

### 1.3 Add `X-Device-Platform` to CORS allowed headers

**Subject**: Add `'X-Device-Platform'` to the `DEFAULT_HEADERS` array

**Files affected**:

- `apps/api/src/middleware/cors.ts`

**Acceptance criteria**:

- `'X-Device-Platform'` is present in `DEFAULT_HEADERS`
- Order of other allowed headers is unchanged
- Environment variable `ALLOWED_HEADERS` override still works — when set, the env list is used as-is (operator must include the new header themselves)

**Dependencies**: None

**Estimate**: Small (1 line added)

**Test evidence required**: Existing CORS tests pass; manual verification that OPTIONS response includes `x-device-platform` in `Access-Control-Allow-Headers`.

---

### 1.4 Add `platform` column to `purchases` Drizzle schema

**Subject**: Add `platform: text('platform').notNull()` to the `purchases` table definition

**Files affected**:

- `apps/api/src/db/schema.ts`

**Acceptance criteria**:

- `purchases` table definition includes `platform: text('platform').notNull()`
- Column uses `text` type (not `platformEnum`), per design decision
- No `.default()` is set on the column — application code always provides a value
- No other column in `purchases` is modified
- No other table is modified
- TypeScript compiles without errors

**Dependencies**: None

**Estimate**: Small (1 line added)

**Test evidence required**: TypeScript compilation passes; Drizzle schema introspection shows the new column.

---

### 1.5 Generate and adjust DDL migration for `purchases.platform`

**Subject**: Generate DDL migration and apply two-step SQL pattern (add column with DEFAULT, then drop default)

**Files affected**:

- `apps/api/migrations/0010_*.sql` (new file, exact name from `drizzle-kit generate`)
- `apps/api/migrations/meta/0010_snapshot.json` (new file)
- `apps/api/migrations/meta/_journal.json` (edit — append new entry)

**Acceptance criteria**:

- Migration name/id continues from existing sequence (0009 → 0010)
- Generated SQL is adjusted to the two-step pattern:
  1. `ALTER TABLE sonora.purchases ADD COLUMN platform text NOT NULL DEFAULT 'android';`
  2. `ALTER TABLE sonora.purchases ALTER COLUMN platform DROP DEFAULT;`
- The final column state is `text NOT NULL` with **no DEFAULT** — application code always supplies the value
- `bun run db:migrate` applies successfully (tested against local/dev DB)
- Existing rows get `platform = 'android'` from the temporary default

**Dependencies**: 1.4 (schema change)

**Estimate**: Small (run generate, edit SQL, update journal)

**Test evidence required**: Migration applies cleanly. Rollback works (`drizzle-kit drop` + re-migrate). Verify column constraints in DB inspector.

---

### 1.6 Update `POST /payments/create` — persist platform from header

**Subject**: Add `platform: c.var.devicePlatform ?? 'unknown'` to the purchase insert values

**Files affected**:

- `apps/api/src/routes/payments.ts`

**Acceptance criteria**:

- The `.values({...})` call in the `/payments/create` handler includes `platform: c.var.devicePlatform ?? 'unknown'`
- When `X-Device-Platform` header is set (e.g. `ios`), the inserted row has `platform = 'ios'`
- When `X-Device-Platform` header is absent, the inserted row has `platform = 'unknown'`
- No other insert field is changed
- No other route or handler is changed in this task

**Dependencies**: 1.1 (Variables interface), 1.2 (middleware sets devicePlatform), 1.4 (schema column exists)

**Estimate**: Small (~3 lines changed)

**Test evidence required**:

- Updated route test (in `security-middleware-chain.test.ts` or dedicated payments route test) asserts `purchases.platform` is set from `c.var.devicePlatform`
- Test with header present → `platform = 'ios'`
- Test with header absent → `platform = 'unknown'`

---

### 1.7 Update `POST /experiences/:id/access` — header platform takes precedence over body

**Subject**: Use `c.var.devicePlatform ?? body.platform ?? null` as platform value in access insert

**Files affected**:

- `apps/api/src/routes/payments.ts`

**Acceptance criteria**:

- The access insert uses `const platform = c.var.devicePlatform ?? body.platform ?? null`
- When `X-Device-Platform` header is `ios` and body has `platform: 'android'`, the stored value is `'ios'` (header wins)
- When header is absent, body's `platform` field is used (existing behavior preserved)
- When both are absent/null, stored value is `null` (existing behavior preserved)
- No other insert field is changed

**Dependencies**: 1.1 (Variables), 1.2 (middleware)

**Estimate**: Small (~3 lines changed)

**Test evidence required**: Route handler test with: header wins over body; body fallback; null fallback.

---

### 1.8 Update `security-middleware-chain.test.ts` rate limit helper

**Subject**: Remove hashing from `rateLimitKey()` helper — `c.var.deviceId` is now passthrough

**Files affected**:

- `apps/api/src/__tests__/security-middleware-chain.test.ts`

**Acceptance criteria**:

- The `rateLimitKey` helper computes the key from `rawDeviceId` directly (no `hashDeviceId` call)
- Comment above the helper is updated to reflect new middleware behavior
- All test cases in the file pass

**Dependencies**: 1.2 (middleware behavior change)

**Estimate**: Small (~5 lines changed)

**Test evidence required**: `bun run test` in `apps/api` passes with all updated expectations.

---

### 1.9 Update `device-id-guard.test.ts` integration test expectations

**Subject**: Update integration test to expect passthrough value instead of hashed value

**Files affected**:

- `apps/api/src/__tests__/middleware/device-id-guard.test.ts`

**Acceptance criteria**:

- The integration test block titled `'allows request when deviceId is set by injectDeviceId middleware'` sends `X-Device-Id: 550e8400-e29b-4a4a-a716-446655440000`
- After middleware runs, `c.var.deviceId` equals the raw header value (`'550e8400-e29b-4a4a-a716-446655440000'`)
- All assertions pass

**Dependencies**: 1.2

**Estimate**: Small (1 line change — remove hash expectation)

**Test evidence required**: Vitest passes.

---

## PR 2 — Mobile + Shared: SHA-256 hashing and platform header (~200–250 lines)

### 2.1 Add `expo-crypto` dependency to mobile

**Subject**: Add `expo-crypto` to `apps/mobile/package.json` dependencies

**Files affected**:

- `apps/mobile/package.json`

**Acceptance criteria**:

- `"expo-crypto"` is added with version compatible with Expo SDK 56 (e.g. `"~14.1.0"`)
- `bun install` completes successfully (dependencies resolved)
- `expo-crypto` is importable from native mobile code

**Dependencies**: None

**Estimate**: Small (1 line)

**Test evidence required**: `bun install` succeeds; no TypeScript errors when importing `expo-crypto`.

---

### 2.2 Create `sha256` utility in `packages/shared`

**Subject**: Create `packages/shared/src/utils/sha256.ts` using Web Crypto API

**Files affected**:

- `packages/shared/src/utils/sha256.ts` (NEW)
- `packages/shared/src/index.ts` (EDIT — add export)

**Acceptance criteria**:

- File `packages/shared/src/utils/sha256.ts` exports `async function sha256(value: string): Promise<string>`
- Uses `crypto.subtle.digest('SHA-256', ...)` via Web Crypto API
- Returns lowercase 64-character hex digest
- Implementation matches the current `hashDeviceId` in `apps/api/src/middleware/device-id.ts` (identical algorithm)
- `packages/shared/src/index.ts` exports the new utility: `export * from './utils/sha256'`
- Known test vector: `sha256("test-device-123")` → `"a6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca314058b"`

**Dependencies**: None

**Estimate**: Small (~20 lines new + 1 line export)

**Test evidence required**:

- Unit test in `packages/shared/src/__tests__/`:
  - Known digest matches
  - Deterministic: same input twice → same output
  - Different inputs produce different digests
  - Empty string `""` produces valid SHA-256 digest
  - Unicode/non-ASCII input produces valid digest (UTF-8 encoding)

---

### 2.3 Update `DeviceService.getPlatformDeviceId()` native — hash with expo-crypto

**Subject**: SHA-256 hash the raw device ID before returning in native `DeviceService`

**Files affected**:

- `apps/mobile/src/services/device-service.ts`

**Acceptance criteria**:

- Imports `* as Crypto from 'expo-crypto'`
- After obtaining the raw platform device ID (or fallback UUID), calls `Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawDeviceId)`
- Returns the SHA-256 hash (never the raw ID)
- The raw platform device ID is NOT stored in any variable, property, or closure accessible outside the function scope
- Error fallback returns `'fallback-device-id'` (unchanged)
- Callers of `getPlatformDeviceId()` receive the hashed value transparently — no API change

**Dependencies**: 2.1 (expo-crypto dependency)

**Estimate**: Small (~10 lines changed in the function body)

**Test evidence required**:

- `apps/mobile/src/services/__tests__/device-service.test.ts` updated:
  - Mock `expo-crypto` `digestStringAsync` to return a deterministic hash
  - Android path: `Application.getAndroidId()` returns `'mock-android-id'` → expected return is `SHA-256('mock-android-id')`
  - iOS path: `Application.getIosIdForVendorAsync()` returns `'mock-ios-id'` → expected return is `SHA-256('mock-ios-id')`
  - Fallback to SQLite: persisted UUID is hashed before return
  - Generate + persist UUID path: generated UUID is hashed before return
  - Error fallback: returns `'fallback-device-id'` unchanged
  - **100% coverage** of the modified file

---

### 2.4 Update `DeviceService.getPlatformDeviceId()` web — hash with shared sha256

**Subject**: SHA-256 hash the device ID before returning in web `DeviceService`

**Files affected**:

- `apps/mobile/src/services/device-service.web.ts`

**Acceptance criteria**:

- Imports `sha256` from `@sonora/shared`
- After obtaining the raw device ID from localStorage (or generated UUID), calls `await sha256(rawDeviceId)`
- Returns the SHA-256 hash (never the raw ID)
- Error fallback returns `'fallback-web-device-id'` (unchanged)

**Dependencies**: 2.2 (shared sha256 export)

**Estimate**: Small (~5 lines changed)

**Test evidence required**:

- `device-service.web.test.ts` updated:
  - Mock `sha256` from `@sonora/shared`
  - Existing UUID → hash returned
  - New UUID generated → hash returned
  - Error fallback returns `'fallback-web-device-id'`
  - **100% coverage**

---

### 2.5 Update `MobileApiClient.getAuthHeader()` — add `X-Device-Platform`

**Subject**: Add `X-Device-Platform` header to `getAuthHeader()` in `MobileApiClient`

**Files affected**:

- `apps/mobile/src/services/api-client.ts`

**Acceptance criteria**:

- Import `Platform` from `react-native`
- The returned headers object from `getAuthHeader()` includes `'X-Device-Platform': Platform.OS as string`
- The value is `'ios'`, `'android'`, or `'web'` at runtime
- `X-Device-Id` header is still present (unchanged behavior)
- All existing request methods (`get`, `post`, `put`, `patch`, `delete`) automatically include the new header via `getAuthHeader()`

**Dependencies**: 2.3 or 2.4 (DeviceService returns hashed ID — header addition is independent but both are part of the mobile deploy)

**Estimate**: Small (~3 lines changed)

**Test evidence required**:

- `apps/mobile/src/services/__tests__/api-client.test.ts` updated:
  - Existing test `'automatically injects X-Device-Id header'` also asserts `X-Device-Platform` header is present
  - New test: `X-Device-Platform` value matches one of `ios`, `android`, `web`
  - New test: `fetchWithDeviceId` includes `X-Device-Platform` header
  - All existing tests pass (mock `Platform.OS` as needed)
  - **100% coverage** of modified lines

---

### 2.6 Update `ApiClient.fetchWithDeviceId()` — add `X-Device-Platform`

**Subject**: Add `X-Device-Platform` header to `fetchWithDeviceId()`

**Files affected**:

- `apps/mobile/src/services/api-client.ts`

**Acceptance criteria**:

- Import `Platform` from `react-native` (or reuse existing import)
- After setting `X-Device-Id`, also call `headers.set('X-Device-Platform', Platform.OS as string)`
- The header value matches the runtime platform

**Dependencies**: 2.5 (same file, same import)

**Estimate**: Small (1 line added)

**Test evidence required**: Same as 2.5 — `fetchWithDeviceId` test asserts `X-Device-Platform` header presence and value.

---

## PR 3 — Migration script (~120–150 lines)

### 3.1 Create `migrate-device-ids.ts` script

**Subject**: Create one-time data migration script to SHA-256 hash raw device IDs in the database

**Files affected**:

- `apps/api/scripts/migrate-device-ids.ts` (NEW)

**Acceptance criteria**:

- Shebang: `#!/usr/bin/env bun`
- Imports `sha256` from `@sonora/shared`
- Connects to DB using `DATABASE_URL` env var (with optional `--connection-string` override)
- Scans `sonora.purchases.device_id` and `sonora.experience_accesses.device_id`
- Detection: value matching `/^[0-9a-f]{64}$/i` → already hashed (skip). NULL → skip. Empty → skip. Everything else → raw (needs hashing)
- `--dry-run` flag: logs each raw value and its would-be hash; no UPDATE executed
- Without `--dry-run`: executes UPDATEs in a transaction
- Logs summary report at end: `totalRows`, `rawRows`, `alreadyHashedRows`, `nullRows`, `updatedRows`, `errors`
- Error handling: single UPDATE failure is logged and counted in `errors`; script continues processing remaining rows
- Exit code: 0 on success (even if some rows errored), non-zero on connection failure
- CLI usage: `bun run apps/api/scripts/migrate-device-ids.ts [--dry-run] [--connection-string <url>]`

**Dependencies**: 2.2 (shared sha256 utility)

**Estimate**: Medium (~100–120 lines new)

**Test evidence required**:

- Unit test for detection logic: identify raw vs already-hashed vs null vs empty
- Unit test for `sha256` integration (same known digest)
- Dry-run test against in-memory DB or mock: logs changes, no UPDATE executed
- Live-run test against in-memory DB or mock: raw IDs are hashed, already-hashed left unchanged, nulls left unchanged
- Error handling test: simulated DB error on one row continues processing

---

### 3.2 Add migration script tests

**Subject**: Add comprehensive tests for the migration script

**Files affected**:

- `apps/api/src/__tests__/migrate-device-ids.test.ts` (NEW)

**Acceptance criteria**:

- Tests use a mock DB (or lightweight test DB) — no production connection
- Test: dry-run with mixed data (raw, hashed, null, empty) reports correct counts and does not modify data
- Test: live-run hashes raw IDs, leaves already-hashed and null untouched
- Test: error on one row does NOT abort the entire migration
- Test: empty tables produce zero counts without error
- Test: `--dry-run` flag is parsed correctly from CLI args
- Test: detection function correctly classifies: 64-char hex (any case) → already hashed; shorter hex → raw; UUID v4 → raw; arbitrary string → raw

**Dependencies**: 3.1 (script exists)

**Estimate**: Medium (~80–100 lines new)

**Test evidence required**: `bun run test` in `apps/api` passes (vitest). All above scenarios pass.

---

## Ownership summary

- [x] 1.1 Add `devicePlatform` to Variables interface <!-- sdd-owner: implementation -->
- [x] 1.2 Rewrite `injectDeviceId` middleware <!-- sdd-owner: implementation -->
- [x] 1.3 Add `X-Device-Platform` to CORS <!-- sdd-owner: implementation -->
- [x] 1.4 Add `platform` column to purchases schema <!-- sdd-owner: implementation -->
- [x] 1.5 Generate and adjust DDL migration <!-- sdd-owner: implementation -->
- [x] 1.6 Update POST /payments/create platform persistence <!-- sdd-owner: implementation -->
- [x] 1.7 Update POST /experiences/:id/access header precedence <!-- sdd-owner: implementation -->
- [x] 1.8 Update rate limit helper in security-middleware-chain.test.ts <!-- sdd-owner: implementation -->
- [x] 1.9 Update device-id-guard.test.ts expectations <!-- sdd-owner: implementation -->
- [x] 2.1 Add expo-crypto dependency <!-- sdd-owner: implementation -->
- [x] 2.2 Create shared sha256 utility <!-- sdd-owner: implementation -->
- [x] 2.3 Update DeviceService native — hash with expo-crypto <!-- sdd-owner: implementation -->
- [x] 2.4 Update DeviceService web — hash with shared sha256 <!-- sdd-owner: implementation -->
- [x] 2.5 Update getAuthHeader() — add X-Device-Platform <!-- sdd-owner: implementation -->
- [x] 2.6 Update fetchWithDeviceId() — add X-Device-Platform <!-- sdd-owner: implementation -->
- [ ] 3.1 Create migrate-device-ids.ts script <!-- sdd-owner: implementation -->
- [ ] 3.2 Add migration script tests <!-- sdd-owner: implementation -->

- [ ] Start or reuse bounded review for PR 1 <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for PR 2 <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for PR 3 <!-- sdd-owner: parent -->
- [ ] Deploy DDL migration and run data migration before backend deploy <!-- sdd-owner: parent -->
- [ ] Verify CORS preflight on web after backend deploy <!-- sdd-owner: parent -->
- [ ] Mobile deploy via EAS after backend is live <!-- sdd-owner: parent -->
