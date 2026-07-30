# Apply Progress — PR 1 (Backend)

## Status: Complete

All 377 tests pass (34 files). Git commits are staged and ready for lifecycle approval — the OpenCode environment blocked `git commit` with a lifecycle guard. All changes are tracked below.

## TDD Cycle Evidence

| Task                          | Phase       | Command                                                               | Result                                       |
| ----------------------------- | ----------- | --------------------------------------------------------------------- | -------------------------------------------- |
| 1.2 injectDeviceId rewrite    | RED         | Updated device-id.test.ts to expect raw value instead of hash         | 5 tests failed                               |
| 1.2 injectDeviceId rewrite    | GREEN       | Removed `hashDeviceId()` call from middleware, pass-through raw value | 18 tests passed (incl. 7 new platform tests) |
| 1.2 Platform header tests     | RED → GREEN | Added 7 X-Device-Platform tests, all passed after implementation      | 7/7 passed                                   |
| 1.8 CORS test                 | RED → GREEN | Updated expected headers to include X-Device-Platform                 | Passed                                       |
| 1.8 payments test             | RED → GREEN | Updated deviceId expectation to raw value; added platform assertions  | Passed                                       |
| 1.8 audio test                | RED → GREEN | Updated `generateToken()` to use raw deviceId (not hashed)            | 18 audio tests passed                        |
| 1.8 security-middleware-chain | RED → GREEN | Updated `rateLimitKey()` to use raw deviceId (no hash)                | Passed                                       |

## Completed Tasks & Files Changed

### 1.1 Variables interface

- **File**: `apps/api/src/index.ts`
- **Change**: Added `devicePlatform?: 'ios' | 'android' | 'web'` to `Variables` interface
- **Commit**: `feat(api): add devicePlatform to Variables interface`
- **Test**: TypeScript compilation (clean)

### 1.2 Rewrite injectDeviceId middleware

- **File**: `apps/api/src/middleware/device-id.ts`
- **Changes**:
  - Removed `hashDeviceId()` call from `injectDeviceId` — pass-through raw value
  - Kept `hashDeviceId()` exported for backward compat
  - Added `VALID_PLATFORMS` constant
  - Added `X-Device-Platform` header parsing: validates against `['ios','android','web']`, silently ignores invalid
  - Sets `c.var.devicePlatform` when valid
- **Commit**: `feat(api): rewrite injectDeviceId for pass-through device ID and platform extraction`

### 1.3 Update CORS

- **File**: `apps/api/src/middleware/cors.ts`
- **Change**: Added `'X-Device-Platform'` to `DEFAULT_HEADERS` array
- **Commit**: `feat(api): add X-Device-Platform to CORS allowed headers`

### 1.4 DB schema

- **File**: `apps/api/src/db/schema.ts`
- **Change**: Added `platform: text('platform').notNull()` to `purchases` table
- **Commit**: `feat(api): add platform column to purchases schema`

### 1.5 Migration

- **Files**:
  - `apps/api/migrations/0011_vengeful_lockheed.sql` (NEW)
  - `apps/api/migrations/meta/0011_snapshot.json` (NEW)
  - `apps/api/migrations/meta/_journal.json` (updated)
- **SQL**: Two-step pattern per design:
  1. `ALTER TABLE ... ADD COLUMN platform text NOT NULL DEFAULT 'android'`
  2. `ALTER TABLE ... ALTER COLUMN platform DROP DEFAULT`
- **Commit**: `feat(api): generate migration for purchases.platform column`

### 1.6 Purchase route platform persistence

- **File**: `apps/api/src/routes/payments.ts`
- **Change**: Added `platform: c.var.devicePlatform ?? 'unknown'` to purchase insert values
- **Commit**: `feat(api): persist platform from header on purchase creation`

### 1.7 Access route header precedence

- **File**: `apps/api/src/routes/payments.ts`
- **Change**: `platform: c.var.devicePlatform ?? body.platform ?? null` — header wins over body
- **Commit**: `feat(api): use header platform with body fallback on access route`

### 1.8 Updated tests

- **Files**:
  - `apps/api/src/__tests__/device-id.test.ts` — pass-through expectations + 7 platform tests
  - `apps/api/src/__tests__/payments.test.ts` — raw deviceId + platform assertions
  - `apps/api/src/__tests__/audio.test.ts` — `generateToken()` uses raw deviceId (not hashed)
  - `apps/api/src/__tests__/security-middleware-chain.test.ts` — `rateLimitKey()` uses raw deviceId
  - `apps/api/src/middleware/__tests__/cors.test.ts` — added X-Device-Platform to expected headers

## Task Checkboxes (persisted in tasks.md)

- [x] 1.1 Add `devicePlatform` to Variables interface
- [x] 1.2 Rewrite `injectDeviceId` middleware
- [x] 1.3 Add `X-Device-Platform` to CORS
- [x] 1.4 Add `platform` column to purchases schema
- [x] 1.5 Generate and adjust DDL migration
- [x] 1.6 Update POST /payments/create platform persistence
- [x] 1.7 Update POST /experiences/:id/access header precedence
- [x] 1.8 Update rate limit helper in security-middleware-chain.test.ts
- [x] 1.9 Update device-id-guard.test.ts expectations (no change needed — test uses raw deviceId via middleware naturally)
- [ ] 2.1–3.2 Mobile + shared + migration script (PR 2 & PR 3)
- [ ] Parent-owned review/receipt tasks

## Git Commits Staged

The following commits are ready (blocked by OpenCode lifecycle guard on `git commit`):

1. `feat(api): add devicePlatform to Variables interface` — `apps/api/src/index.ts`
2. `feat(api): rewrite injectDeviceId for pass-through device ID and platform extraction` — middleware + all test updates
3. `feat(api): add X-Device-Platform to CORS allowed headers` — cors.ts
4. `feat(api): add platform column to purchases schema` — schema.ts
5. `feat(api): generate migration for purchases.platform column` — migration files
6. `feat(api): persist platform from header on purchase creation` — payments.ts
7. `feat(api): use header platform with body fallback on access route` — payments.ts
8. `test(api): update tests for pass-through device ID and platform behavior` — all test files

## Deviations from Design

- **JWT token generation in audio test**: The `generateToken()` helper previously hashed the deviceId before embedding in JWT. Since `injectDeviceId` now passes through the raw value, the JWT `deviceId` claim now matches `c.var.deviceId` (both are the raw header value). This is correct behavior — in production, the `experiences` route already generates tokens with `c.var.deviceId` directly.
- **device-id-guard.test.ts**: No changes were needed — the integration test with `injectDeviceId` + `deviceIdGuard` already uses the raw deviceId value correctly because it tests that `deviceId` is set (not what the specific value is).

## Remaining Tasks

- [ ] 2.1 Add expo-crypto dependency
- [ ] 2.2 Create shared sha256 utility
- [ ] 2.3 Update DeviceService native
- [ ] 2.4 Update DeviceService web
- [ ] 2.5 Update getAuthHeader()
- [ ] 2.6 Update fetchWithDeviceId()
- [ ] 3.1 Create migrate-device-ids.ts script
- [ ] 3.2 Add migration script tests
- [ ] Parent: Start/reuse bounded review
- [ ] Parent: Deploy DDL migration + data migration
- [ ] Parent: Verify CORS preflight on web

## Workload Estimation

- **Lines changed**: ~120 additions, ~50 deletions (within PR 1 budget of 200–250)
- **PR boundary**: PR 1 complete — backend only. Ready for review.
