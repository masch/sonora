# Apply Progress — Analytics App Version Enrichment

**Change:** `2026-08-01-analytics-app-version`
**Slice:** First (only slice — small, additive, single PR)
**Branch:** `feat/analytics-app-version`
**Executor:** `sdd-apply` (delegated, attempt token `sha256:273604f71e2e35f4d2cd9fc76be076e3ab954f53d248b73518ed3d22bd2eb5b1`, request-id `sdd-apply-20260801-01`)
**Strict TDD:** Active — RED → GREEN cycles followed, evidence recorded below.

---

## T0 — Expo v56 documentation verification (AC-10, NFR-4) — PASS

**Verification path used:** packages-only (no browser tool available in this environment; installed-package artifacts are the authoritative ground truth).

All four items re-confirmed against installed artifacts in `apps/mobile/node_modules/`:

| Item                                      | Artifact verified                                                                                                                                                                                          | Result                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| §3.1 `nativeApplicationVersion` semantics | `expo-application@56.0.3` → `build/Application.d.ts`: `nativeApplicationVersion: string \| null`, "On web, this value is `null`"; version name from `version` in app config / `CFBundleShortVersionString` | PASS — null → `'0.0.0'` fallback; Expo Go reports Expo Go's binary version (accepted, dev-only)            |
| §3.2 `expoConfig` availability            | `expo-constants@56.0.21` → `build/Constants.types.d.ts:166-175`: `expoConfig` on classic/modern manifests (embedded or remote); `expoGoConfig` populated in Expo Go                                        | PASS — `app-version.ts` reads `Constants.expoConfig?.extra?.appVersionName ?? '0.0.0'`, consistent         |
| §3.3 Firebase Analytics `logEvent`        | `@react-native-firebase/analytics@21.14.0` (`lib/index.d.ts:891-894` — free-form `params?: { [key: string]: any }`; limits applied in cloud, not local rejections) + `firebase@11.3.1` web SDK             | PASS — `app_version` (11 chars) ≤ 40-char name, semver values ≪ 100-char limit, not a reserved param name  |
| §3.4 Crashlytics `setAttribute`           | `@react-native-firebase/crashlytics@21.14.0` → `lib/index.d.ts:219`: `setAttribute(name: string, value: string): Promise<null>`                                                                            | PASS — 11-char key ≤ 64, semver values ≪ 1024; key count stays at 2 (`custom_description` + `app_version`) |

No discrepancies. Zero lines changed.

---

## Cycle 1 — Logger wrapper (FR-4, FR-5, NFR-1, NFR-5)

### T1 (RED) — `apps/mobile/src/utils/__tests__/logger.test.ts`

- Added `jest.mock('@/utils/app-version', …)` returning `{ versionName: 'test-version', formatted: 'test-version' }` at module scope.
- Updated every exact console-arg assertion per §9.3 to append the trailing `{ app_version: 'test-version' }` object (debug/info/warn/error, metadata passthrough, multiple args, shows-warn/shows-error in production, no-args → `('[INFO]', { app_version: 'test-version' })`, undefined → `('[INFO]', undefined, { app_version: 'test-version' })`).
- Added focused test "appends app_version metadata to every level" (spies on `console.log`/`warn`/`error`; asserts all four levels).
- Retained the four production-suppression tests unchanged in structure.

**RED evidence** (`bun run jest src/utils/__tests__/logger.test.ts --watchAll=false`):

```
Tests:       11 failed, 2 passed, 13 total
```

Failing: all 10 exact-assertion tests + the new "every level" test — failures show trailing object missing (`Received` lacks `{"app_version": "test-version"}`). Passing: the two suppression-only tests (`suppresses debug/info in production`), which assert `not.toHaveBeenCalled()`.

### T2 (GREEN) — `apps/mobile/src/utils/logger.ts`

Implemented the enrichment wrapper per §4.1.

**Documented deviation from the literal design code (§4.1):** the design's literal `sharedLogger.debug(...enrich(args))` double-nests the argument list — `enrich(args)` passes the rest-array as a single argument, so `enrich` returns `[args, { app_version }]` and the console line received `['test message']` (an array) instead of `'test message'`. Verified empirically on the first GREEN attempt (11 failed). The design's own shape table (§4.2) and the T1 assertions require flat output, so the correct call is `sharedLogger.debug(...enrich(...args))` for all four levels. Behavior otherwise exactly per §4.1/§4.2.

**GREEN evidence** (same command):

```
Test Suites: 1 passed, 1 total
Tests:       13 passed, 13 total
```

Exported interface unchanged `{ debug, info, warn, error }` with `(...args: unknown[]) => void`; enrichment is a trailing object; `getAppVersion()` sync, evaluated once per call; suppression decision stays in the shared logger's `log()`; `packages/shared/src/utils/logger.ts` untouched (NFR-1).

---

## Cycle 2 — AnalyticsService enrichment (FR-1, FR-2, FR-3)

### T3 (RED) — `apps/mobile/src/services/__tests__/analytics.test.ts`

- Added the `jest.mock('@/utils/app-version', …)` at module scope with the other mocks.
- Native exact-param assertion → `{ foo: 'bar', platform: 'ios', app_version: 'test-version' }`.
- Native `recordError` test → added `expect(mockSetAttribute).toHaveBeenCalledWith('app_version', 'test-version')`; kept `custom_description` and `recordError(error)` assertions.
- Web exact-param assertion → `{ foo: 'web_bar', platform: 'web', app_version: 'test-version' }`.
- Web console-error assertion → `('[ERROR]', '[Web Error]', error, 'Web custom description', { app_version: 'test-version' })`.
- No new analytics test blocks added (FR-6 exact scope).

**RED evidence** (`bun run jest src/services/__tests__/analytics.test.ts --watchAll=false`):

```
Tests:       3 failed, 2 passed, 5 total
```

Failing (exactly the three service-side mismatches):

1. native trackEvent — `app_version` missing from `logEvent` payload;
2. native recordError — `setAttribute('app_version', 'test-version')` never called (only `custom_description`);
3. web trackEvent — `app_version` missing from web `logEvent` params.

Passing: web console-error test (wrapper already green from T2 — expected per design §10) + `initializeGlobalErrorTracking` listener test.

### T4 (GREEN) — `apps/mobile/src/services/analytics.ts` + `analytics.web.ts`

- `analytics.ts` (§6.1): `import { getAppVersion } from '@/utils/app-version';`; `extendedParams` gains `app_version: getAppVersion().versionName` next to `platform`.
- `analytics.ts` (§5.1): `firebaseCrashlytics().setAttribute('app_version', getAppVersion().versionName);` set unconditionally inside the `isFirebaseAvailable() && firebaseCrashlytics` branch, before the `custom_description` guard; fire-and-forget (no await), same as existing `custom_description` call. Signature unchanged.
- `analytics.web.ts` (§6.2): same import + `extendedParams` enrichment. `recordError` NOT modified (wrapper appends the version exactly once — FR-3).

**GREEN evidence** (same command):

```
Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

Signatures unchanged; 20+ call sites and event map types untouched (NFR-3). Double `app_version` on `AnalyticsService` console-fallback lines is accepted, not deduped (design §7).

---

## T5 (Gate) — `make validate` + isolation + scope — PASS

**`make validate` (repo root):** EXIT_CODE=0 — all targets green: format, lint, typecheck, api-typecheck, scripts-typecheck, doctor-ci, test (includes the API suite with the logger spies in `apps/api/src/__tests__/payments.test.ts:400-401` — proving NFR-1), gga. Full log: `/tmp/validate.log`.

**Backend isolation (NFR-1):**

```
$ git diff --stat -- packages/shared apps/api
(empty — EXIT 0)
```

`packages/shared/src/utils/logger.ts` byte-identical; no `apps/api` file modified. API-side console lines in the test output carry no version object; mobile lines carry `{ app_version: 'mock' }` — confirmed in the validate log (e.g. `[ERROR] Download failed for track-1 … { app_version: 'mock' }`).

**Scope (AC-8, NFR-2/NFR-3):** `git diff --name-only` shows exactly the 5 approved files:

1. `apps/mobile/src/services/analytics.ts`
2. `apps/mobile/src/services/analytics.web.ts`
3. `apps/mobile/src/utils/logger.ts`
4. `apps/mobile/src/services/__tests__/analytics.test.ts`
5. `apps/mobile/src/utils/__tests__/logger.test.ts`

No call sites, event map types, `app.config.ts`, or `app-version` helpers changed; no dependency added.

**FR-5 verified in the diff:** the only version source is `getAppVersion().versionName` (4 usages across the changed source files); zero occurrences of `versionCode`/build number; `'0.0.0'` fallback untouched; no new fallback invented.

**Changed-line budget:** 76 insertions / 12 deletions = 88 changed lines across 5 files — ~22% of the 400-line budget, consistent with the "Low" risk forecast.

**app-version helpers:** `bun run jest src/__tests__/app-version` → 3 suites passed, 8 tests (helpers untouched, still green).

---

## Task checkbox updates (persisted tasks artifact)

`openspec/changes/2026-08-01-analytics-app-version/tasks.md` — the file uses `### T{n}` headings with `sdd-owner` markers (no `- [ ]` checklist syntax). Marked each completed implementation task with a visible `- [x] **T{n} complete**` line directly under its heading. T0, T1, T2, T3, T4, T5 all marked. Parent-owned rows (P1, P2) preserved byte-for-byte, listed as deferred lifecycle actions.

## Remaining tasks (unchecked, parent-owned)

- P1 — Bounded post-apply review of the frozen candidate (`<!-- sdd-owner: parent -->`)
- P2 — Lifecycle gate and single-PR delivery (`<!-- sdd-owner: parent -->`)

## Files changed (this batch)

| File                                                   | Action                                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `apps/mobile/src/utils/logger.ts`                      | Re-export → enrichment wrapper (trailing `{ app_version }`, all 4 levels)        |
| `apps/mobile/src/utils/__tests__/logger.test.ts`       | Mock + updated exact assertions + "every level" test                             |
| `apps/mobile/src/services/analytics.ts`                | `app_version` in `extendedParams` + Crashlytics `setAttribute('app_version', …)` |
| `apps/mobile/src/services/analytics.web.ts`            | `app_version` in `extendedParams`; `recordError` unchanged                       |
| `apps/mobile/src/services/__tests__/analytics.test.ts` | Mock + 4 updated exact assertions + `setAttribute` assertion                     |

## TDD Cycle Evidence

| Cycle              | RED command                                                              | RED result                                                                          | GREEN command | GREEN result              |
| ------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------- | ------------------------- |
| 1 (logger wrapper) | `bun run jest src/utils/__tests__/logger.test.ts --watchAll=false`       | 11 failed / 2 passed (trailing object missing)                                      | same          | 13/13 passed              |
| 2 (analytics)      | `bun run jest src/services/__tests__/analytics.test.ts --watchAll=false` | 3 failed / 2 passed (app_version missing from payloads + setAttribute never called) | same          | 5/5 passed                |
| Gate               | `make validate` (repo root)                                              | —                                                                                   | —             | EXIT 0, all targets green |

## Deviations from design

1. **`enrich(...args)` vs design's literal `enrich(args)` (logger.ts §4.1):** the literal `sharedLogger.debug(...enrich(args))` double-nests the rest-array (empirically reproduced: console received `['test message']` as a single arg). Corrected to `...enrich(...args)` to satisfy §4.2 shape table and T1 assertions. No interface or behavior difference from the design's intent.
2. **tasks.md completion markers:** added `- [x] T{n} complete` lines under each heading because the persisted tasks artifact has no `- [ ]` checklist syntax (documented above).

## Risks

- Engram HTTP server was unreachable during this batch (`http://127.0.0.1:7437` — `mem_search`/`mem_save` unavailable). Apply-progress is persisted as the file artifact; Engram save will be attempted separately. No impact on code correctness.
- Expo Go dev sessions report Expo Go's binary version via `nativeApplicationVersion` — accepted, dev-only (design §2/§11).
- Double `app_version` on `AnalyticsService` console-fallback lines — accepted (design §7).

## Workload / PR boundary

Single PR (no chain — `Chained PRs recommended: No`, `400-line budget risk: Low`, `Decision needed before apply: No`). Delivery strategy: `single-pr`. Implementation complete; candidate frozen at 5 files. Parent-owned lifecycle: P1 (bounded review) → P2 (commit + single PR).

---

## Scope extension — `X-App-Version` header (user decision, 2026-08-02)

Per user decision, all frontend API requests also carry the app version:

- **T6 (RED)**: `api-client.test.ts` — added `@/utils/app-version` mock, extended header-injection tests with `X-App-Version`, added `fetchWithDeviceId` header test. RED: 2 failed / 30 passed.
- **T7 (GREEN)**: `api-client.ts` — `X-App-Version` added to `getAuthHeader()` and `fetchWithDeviceId()`; shared base-client untouched. GREEN: 32/32.
- **Refactor (GREEN→GREEN, user request)**: extracted `buildBaseHeaders(deviceId)` helper to eliminate the duplicated base-header declaration between `getAuthHeader()` and `fetchWithDeviceId()`. 32/32 still green.
- **GGA finding (user decision to fix pre-existing)**: `export { RequestOptions }` → `export type { RequestOptions }` (type-only re-export, TS1205/TS1484-safe).
- **GGA pre-existing findings fixed (user decision)**: (1) `PaymentEvents` added to `analytics.web.ts` event map (web/native parity — was missing in HEAD); (2) Spanish log strings → English in `analytics.ts` and `analytics.web.ts`; (3) `amount` annotated as minor units (cents) per AGENTS.md convention #12.

**Gate status**: `make validate` EXIT 2 — only the `gga` step fails intermittently (provider emits `STATUS:` line after the 30-line strict-mode window; apply's original run passed gga EXIT 0). All code gates green: typecheck EXIT 0, targeted jest 50/50, backend isolation diff empty.

---

## GGA non-blocking observations — all 4 fixed (user decision, 2026-08-02)

GGA returned 4 non-blocking observations; user chose to fix all four:

1. **Event-map drift (root cause of PaymentEvents gap)** — extracted the 7 event interfaces + `AnalyticsEventMap` from `analytics.ts`/`analytics.web.ts` into a single shared module `apps/mobile/src/services/analytics-events.ts`; both services import and re-export the types. Single source of truth prevents future web/native drift.
2. **`ensureWebInitialized()` retry** — `isWebInitialized = true` was set before the try/catch, so a failed SDK init never retried. Flag now set only on success (or missing-credentials, where retry changes nothing); a thrown init error leaves the flag unset so the next call retries. Also guarded `typeof window` early-return.
3. **`promise` moved from devDependencies to dependencies** in `apps/mobile/package.json` (same version 8.3.0, no minimumReleaseAge issue) — it is a runtime dep used via `import('promise/...')`. `bun.lock` updated; `bun install --frozen-lockfile` EXIT 0.
4. **`fetchWithDeviceId()` missing `logger.error`** — now logs the same message as `getAuthHeader()` before throwing when `X-Device-Id` is missing.

**CORS exception (user-confirmed, NFR-1 amendment)**: `apps/api/src/middleware/cors.ts` adds `X-App-Version` to `DEFAULT_HEADERS` (with `cors.test.ts`), REQUIRED so browser CORS preflight accepts web requests with the new header. This is the single documented `apps/api` change; spec NFR-1 updated to record the exception.

**Gate status**: `bun install --frozen-lockfile` EXIT 0; targeted jest 50/50 (mobile analytics/api-client/logger); API cors suite 15/15; `make format` EXIT 0; `make typecheck` EXIT 0. Full `make validate` pending (gga provider was flaky; earlier failure was a broken `opencode-ai` postinstall — fixed by `node postinstall.mjs`).

---

## GGA review (2nd run) — false-positive violations documented (2026-08-02)

GGA's second review returned 4 "Testing Conventions (§5)" violations claiming no tests exist for `analytics.ts`, `analytics.web.ts`, `api-client.ts`, `logger.ts`. **All 4 are false positives**: GGA's exclude pattern (`*.test.ts,*.spec.ts,*.test.tsx,*.spec.tsx,*.d.ts` — confirmed in its run log) prevents it from seeing the colocated test files that exist and pass:

- `apps/mobile/src/services/__tests__/analytics.test.ts` — covers native `recordError` (L78), web `AnalyticsServiceWeb` (L99), `initializeGlobalErrorTracking` + `unhandledrejection` wiring (L110-122).
- `apps/mobile/src/services/__tests__/api-client.test.ts` — `Mandatory header enforcement` describe (L428): getAuthHeader + fetchWithDeviceId missing-`X-Device-Id` failure path.
- `apps/mobile/src/utils/__tests__/logger.test.ts` — version-enriching wrapper, log levels, env-aware suppression, edge cases.

Jest: 50/50 passing. The same claim appeared in GGA's first review as observation #4 and was already covered.

GGA's other output confirmed compliance: i18n (§8) clean, payment conventions (§12) clean (amount annotated), API client correctness confirmed, CORS middleware contract respected. Advisory notes (CORS `origin === 'null'` echo, duplicate CORS test files) are pre-existing and out of scope.

**Gate status**: gga provider still does not emit its `STATUS:` line reliably within the strict-mode window (intermittent provider flake, previously diagnosed; also the earlier hard failure was a missing `opencode-ai` postinstall — rerun of `gga run` still times out at 600s tool cap). All code gates green: `bun install --frozen-lockfile` EXIT 0, targeted jest 50/50, API cors suite 15/15, `make format` EXIT 0, `make typecheck` EXIT 0.
