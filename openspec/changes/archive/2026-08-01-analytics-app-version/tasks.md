# Analytics App Version Enrichment — Tasks

**Change:** `analytics-app-version`
**Slice:** First (only slice — small, additive, single PR)
**Strict TDD:** Active (`openspec/config.yaml` → `strict_tdd: true`)

## Review Workload Forecast

| Field                   | Value                                                                        |
| ----------------------- | ---------------------------------------------------------------------------- |
| Estimated changed lines | ~45–65 (2 service files + 1 logger wrapper + 2 test files; all small deltas) |
| 400-line budget risk    | Low                                                                          |
| Chained PRs recommended | No                                                                           |
| Suggested split         | Single PR (no chain needed — estimate is ~15% of the 400-line budget)        |
| Delivery strategy       | single-pr                                                                    |
| Chain strategy          | size-exception                                                               |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

---

## Implementation — strict TDD (design §10)

Dependency-ordered, sequential: `T0 → T1 (RED) → T2 (GREEN) → T3 (RED) → T4 (GREEN) → T5 (gate)`.
Cycle 1 (logger wrapper) is self-contained and unblocks Cycle 2's web console-error assertion.

### T0 — Confirm Expo v56 documentation verification (AC-10, NFR-4) — pre-code gate

- [x] **T0 complete** — TDD evidence in apply-progress.md

**Files:** none (verification only; no code).
**Dependencies:** none.
**Design reference:** design §3 (all four items already PASS against installed SDK 56 package artifacts).

**Acceptance criteria:**

- Re-confirm the four verification items against the installed package artifacts (mandatory, zero-cost): `apps/mobile/node_modules/expo-application/` (§3.1), `apps/mobile/node_modules/expo-constants/build/Constants.types.d.ts` (§3.2), `@react-native-firebase/analytics` + `firebase@11.3.1` (§3.3), `@react-native-firebase/crashlytics` (§3.4).
- `nativeApplicationVersion` semantics: null → `'0.0.0'` fallback; Expo Go reports Expo Go's binary version (accepted, dev-only, design §2/§11).
- GA4 limits: `app_version` (11 chars) ≤ 40-char name, semver values ≤ 100 chars, not a reserved param name (§3.3).
- Crashlytics limits: `app_version` (11 chars) ≤ 64-char key, values ≤ 1024 chars, key count stays at 2 (§3.4).
- If a browser is available, re-check the versioned Expo docs pages (AGENTS.md mandate); if not, the installed-package verification above is sufficient — record which was done.

**Estimated lines changed:** 0
**Test evidence required:** statement in apply-progress of which verification path was used (packages-only, or packages + online docs).

<!-- sdd-owner: implementation -->

### T1 (RED) — Update `logger.test.ts` exact assertions + add enrichment test

- [x] **T1 complete** — TDD evidence in apply-progress.md

**Files:** `apps/mobile/src/utils/__tests__/logger.test.ts`
**Dependencies:** T0.
**Design reference:** §9.1 (mock strategy), §9.3 (exact assertion updates).

**RED test criteria (BEFORE any implementation code):**

- Add `jest.mock('@/utils/app-version', () => ({ getAppVersion: () => ({ versionName: 'test-version', formatted: 'test-version' }) }));` at module scope with the other imports/mocks.
- Update every exact console-arg assertion per §9.3 to append the trailing `{ app_version: 'test-version' }` object:
  - `logger.debug` → `('[DEBUG]', 'test message', { app_version: 'test-version' })`
  - `logger.info` → `('[INFO]', 'info message', { app_version: 'test-version' })`
  - `logger.warn` → `('[WARN]', 'warn message', { app_version: 'test-version' })`
  - `logger.error` → `('[ERROR]', 'error message', { app_version: 'test-version' })`
  - metadata passthrough → `('[INFO]', 'request failed', meta, { app_version: 'test-version' })`
  - multiple args → `('[INFO]', 'event', 'user-login', { userId: 42 }, { app_version: 'test-version' })`
  - `shows warn in production` → `('[WARN]', 'warning in prod', { app_version: 'test-version' })`
  - `shows error in production` → `('[ERROR]', 'error in prod', { app_version: 'test-version' })`
  - no-args → `('[INFO]', { app_version: 'test-version' })` (deliberate behavior change, FR-4)
  - undefined/null → `('[INFO]', undefined, { app_version: 'test-version' })`
- Add the focused test "appends app_version metadata to every level" with the exact code from §9.3 (spies on `console.log`, `console.warn`, `console.error`; asserts all four levels carry the trailing object).
- Retain the four existing production-suppression tests unchanged in structure (debug/info suppressed when `__DEV__` is false; warn/error always emit) — do NOT replace them with a consolidated test (§9.3).

**Run:** `cd apps/mobile && bun run jest src/utils/__tests__/logger.test.ts --watchAll=false`
→ **must fail** (wrapper is still a pure re-export; no trailing object).

**Estimated lines changed:** ~+20 (test file only).
**Test evidence required:** RED failure output showing the assertion mismatches (trailing object missing).

<!-- sdd-owner: implementation -->

### T2 (GREEN) — Implement the mobile logger enrichment wrapper

- [x] **T2 complete** — TDD evidence in apply-progress.md

**Files:** `apps/mobile/src/utils/logger.ts`
**Dependencies:** T1 (RED tests first).
**Design reference:** §4.1 (exact implementation), §4.2 (shape/edge cases), §4.3 (NFR-5), §4.4 (interface).

**GREEN implementation (exact, from §4.1):**

```ts
import { logger as sharedLogger } from '@sonora/shared';
import { getAppVersion } from '@/utils/app-version';

const enrich = (...args: unknown[]): unknown[] => [
  ...args,
  { app_version: getAppVersion().versionName },
];

export const logger = {
  debug: (...args: unknown[]) => sharedLogger.debug(...enrich(args)),
  info: (...args: unknown[]) => sharedLogger.info(...enrich(args)),
  warn: (...args: unknown[]) => sharedLogger.warn(...enrich(args)),
  error: (...args: unknown[]) => sharedLogger.error(...enrich(args)),
};
```

**Acceptance criteria:**

- Exported interface is exactly `{ debug, info, warn, error }` with `(...args: unknown[]) => void` signatures — unchanged from today (FR-4, §4.4).
- Enrichment is a **trailing metadata object**, never a text prefix; message text untouched (§4.2).
- `getAppVersion()` is a synchronous getter evaluated once per call; no async, no I/O, no lazy evaluation (NFR-5, §4.3).
- Suppression behavior preserved: decision stays in the shared logger's `log()`; the wrapper only transforms the argument list (§4.3).
- `packages/shared/src/utils/logger.ts` is NOT modified (NFR-1).
- No-args call → `[INFO] { app_version: … }`; `undefined`-args → message + trailing object (FR-4, covered by T1 tests).

**Run:** `cd apps/mobile && bun run jest src/utils/__tests__/logger.test.ts --watchAll=false`
→ **must pass** (all updated assertions + new "every level" test + retained suppression tests).

**Estimated lines changed:** ~10 (1-line re-export → ~11-line wrapper).
**Test evidence required:** full green run of the logger suite.

<!-- sdd-owner: implementation -->

### T3 (RED) — Update `analytics.test.ts` exact assertions (both platforms)

- [x] **T3 complete** — TDD evidence in apply-progress.md

**Files:** `apps/mobile/src/services/__tests__/analytics.test.ts`
**Dependencies:** T0 (T2 not required for the RED phase, but the suite runs green-only after T2+ T4).
**Design reference:** §9.1 (mock strategy), §9.2 (exact assertion updates).

**RED test criteria (BEFORE any implementation code):**

- Add `jest.mock('@/utils/app-version', () => ({ getAppVersion: () => ({ versionName: 'test-version', formatted: 'test-version' }) }));` at module scope with the other `jest.mock` calls.
- Update the native exact-param assertion (currently `:64`): `expect(mockLogEvent).toHaveBeenCalledWith('test_event', { foo: 'bar', platform: 'ios', app_version: 'test-version' })`.
- In the native `recordError` test (currently `:70-75`): add `expect(mockSetAttribute).toHaveBeenCalledWith('app_version', 'test-version');` — KEEP the existing `custom_description` and `recordError(error)` assertions.
- Update the web exact-param assertion (currently `:81-84`): web `logEvent` params become `{ foo: 'web_bar', platform: 'web', app_version: 'test-version' }`.
- Update the web console-error assertion (currently `:92-97`): `expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', '[Web Error]', error, 'Web custom description', { app_version: 'test-version' })`.
- Do NOT add any new analytics test blocks (FR-6 requires exactly these updates; fallback lines are covered structurally via the `extendedParams` assertions — §9.4).

**Run:** `cd apps/mobile && bun run jest src/services/__tests__/analytics.test.ts --watchAll=false`
→ **must fail** (services don't inject `app_version`; web console line lacks the wrapper-appended object).

**Estimated lines changed:** ~+12 (test file only).
**Test evidence required:** RED failure output showing the assertion mismatches.

<!-- sdd-owner: implementation -->

### T4 (GREEN) — Implement `trackEvent` + `recordError` enrichment in both service files

- [x] **T4 complete** — TDD evidence in apply-progress.md

**Files:**

- `apps/mobile/src/services/analytics.ts`
- `apps/mobile/src/services/analytics.web.ts`

**Dependencies:** T3 (RED tests first), T2 (logger wrapper already green — the web console-error assertion depends on it).
**Design reference:** §5.1 (native recordError), §5.2 (web recordError — unchanged), §6.1 (native trackEvent), §6.2 (web trackEvent).

**GREEN implementation:**

- `analytics.ts` (§6.1): add `import { getAppVersion } from '@/utils/app-version';` with the imports at `:1-2`; extend `extendedParams` (`:85-87`):

  ```ts
  const extendedParams = {
    ...params,
    platform: Platform.OS,
    app_version: getAppVersion().versionName,
  };
  ```

- `analytics.ts` (§5.1): inside the existing `if (isFirebaseAvailable() && firebaseCrashlytics)` branch (`:103-108`), set the attribute **unconditionally before** the `custom_description` guard:

  ```ts
  firebaseCrashlytics().setAttribute('app_version', getAppVersion().versionName);
  ```

  Keep the fire-and-forget pattern (no `await`, no new error handling — matches the existing `custom_description` call). `recordError(error, customDescription?)` signature unchanged.

- `analytics.web.ts` (§6.2): add `import { getAppVersion } from '@/utils/app-version';`; extend `extendedParams` (`:89-91`) identically to native.
- `analytics.web.ts` (§5.2): `recordError` is NOT modified — the wrapper appends the version exactly once (`[ERROR] [Web Error] <error> <description> { app_version: … }`). No explicit duplicate argument (FR-3).

**Acceptance criteria:**

- Firebase `logEvent` payloads on both platforms carry `app_version` (FR-1); console-fallback lines log `extendedParams` and therefore carry it too (no call-site changes).
- Native Crashlytics session gets `setAttribute('app_version', …)` alongside `custom_description` (FR-2); attribute set even without a description.
- `trackEvent`/`recordError` signatures unchanged; 20+ call sites untouched (NFR-3).
- Double `app_version` on `AnalyticsService` console-fallback lines (payload object + wrapper object) is ACCEPTED, not deduped (design §7).

**Run:** `cd apps/mobile && bun run jest src/services/__tests__/analytics.test.ts --watchAll=false`
→ **must pass**.

**Estimated lines changed:** ~+5–7 (2 source files; net additive lines only).
**Test evidence required:** full green run of the analytics suite.

<!-- sdd-owner: implementation -->

### T5 (Gate) — `make validate` + backend isolation + scope verification (AC-7, AC-8, AC-9, FR-5)

- [x] **T5 complete** — TDD evidence in apply-progress.md

**Files:** none new (verification gate).
**Dependencies:** T2, T4 (all code and tests in place).
**Design reference:** §10 Step 5 (full validation), §13 AC mapping.

**Acceptance criteria:**

- `make validate` passes from the repo root (runs `format lint typecheck api-typecheck scripts-typecheck doctor-ci test gga` — includes the API suite with the logger spies in `apps/api/src/__tests__/payments.test.ts:400-401`, proving NFR-1 backend isolation).
- `git diff --stat -- packages/shared apps/api` is EMPTY (NFR-1 — `packages/shared/src/utils/logger.ts` byte-identical, no `apps/api` file modified).
- `git diff --name-only` shows exactly the 5 approved files: `apps/mobile/src/services/analytics.ts`, `apps/mobile/src/services/analytics.web.ts`, `apps/mobile/src/utils/logger.ts`, `apps/mobile/src/services/__tests__/analytics.test.ts`, `apps/mobile/src/utils/__tests__/logger.test.ts` (NFR-2/NFR-3, AC-8 — no call sites, event map types, `app.config.ts`, or `app-version` helpers changed; no dependency added).
- FR-5 verified in the diff: the only version source used is `getAppVersion().versionName`; no build number (`versionCode`) anywhere; `'0.0.0'` fallback untouched; no new fallback invented.
- Full suite green including `app-version.test.ts` / `app-version.native.test.ts` (helpers untouched and still passing).

**Estimated lines changed:** 0 (gate only).
**Test evidence required:** `make validate` output (all targets pass) + `git diff --stat -- packages/shared apps/api` empty output.

<!-- sdd-owner: implementation -->

---

### T6 (RED) — Add `X-App-Version` header assertions to `api-client.test.ts` (FR-7)

**Files:** `apps/mobile/src/services/__tests__/api-client.test.ts`
**Dependencies:** none (independent of T1-T5; runs after them).
**Design reference:** design §14.3.

**Acceptance criteria:**

- Add `jest.mock('@/utils/app-version', () => ({ getAppVersion: () => ({ versionName: 'test-version', formatted: 'test-version' }) }))` to the test file (following the existing mock pattern).
- Extend the existing header-injection tests (`:131-156`) so `objectContaining` includes `'X-App-Version': 'test-version'`.
- Add a `fetchWithDeviceId` test asserting the outgoing fetch headers contain `X-App-Version: 'test-version'` (alongside `X-Device-Id`/`X-Device-Platform`).
- Run `bunx jest src/services/__tests__/api-client.test.ts` — must FAIL RED (implementation not yet added).

### T7 (GREEN) — Implement `X-App-Version` header in `api-client.ts` (FR-7)

**Files:** `apps/mobile/src/services/api-client.ts`
**Dependencies:** T6 (RED).
**Design reference:** design §14.1.

**Acceptance criteria:**

- Add `'X-App-Version': getAppVersion().versionName` to the `MobileApiClient.getAuthHeader()` return object (after `getDeviceId()` succeeds).
- Add `headers.set('X-App-Version', getAppVersion().versionName)` to `fetchWithDeviceId()` alongside the existing device-id sets.
- Import `getAppVersion` from `@/utils/app-version`.
- Run `bunx jest src/services/__tests__/api-client.test.ts` — must PASS GREEN.

---

## Parent tasks (post-apply lifecycle, owned by parent)

### P1 — Bounded post-apply review of the frozen candidate

**Dependencies:** T5 (implementation gate passed; candidate frozen).
**Acceptance criteria:** Native bounded review per the review contract over the exact frozen candidate (5 files). Scope-limited: no reviewer re-derives design decisions; severity follows candidate-causal findings only.
**Verification:** reviewer result receipt; any blocker is surfaced, not silently corrected.

<!-- sdd-owner: parent -->

### P2 — Lifecycle gate and single-PR delivery

**Dependencies:** P1 (review receipt valid).
**Acceptance criteria:** Commit the 5 reviewed files without content/mode changes; validate pre-commit gate; open a single PR (no chain — estimate ~15% of budget). Rollback boundary: revert the 5 files (single revert; no migrations, no schema, no env changes).

<!-- sdd-owner: parent -->

---

## Spec coverage matrix (no dropped requirements)

| Requirement                                                                           | Covered by                                                                               |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| FR-1 `trackEvent` carries `app_version` (native + web, both dispatch paths)           | T3 (assertions), T4 (§6.1, §6.2)                                                         |
| FR-2 Native `recordError` Crashlytics attribute                                       | T3 (setAttribute assertion), T4 (§5.1)                                                   |
| FR-3 Web `recordError` console output carries version, exactly once                   | T3 (console-error assertion), T4 (§5.2 wrapper)                                          |
| FR-4 Logger enriches every level, trailing object, interface unchanged                | T1 (RED), T2 (GREEN §4.1)                                                                |
| FR-5 Version value semantics (name only, single source of truth, `'0.0.0'` unchanged) | T2/T4 (use `getAppVersion().versionName` only), T5 (diff verification)                   |
| FR-6 Tests updated in same change                                                     | T1, T3 (+ retained suppression tests)                                                    |
| NFR-1 Backend isolation                                                               | T2 (shared logger untouched), T5 (`git diff` empty + API suite)                          |
| NFR-2 No new dependencies                                                             | T5 (diff check)                                                                          |
| NFR-3 No call-site/map/config/helper changes                                          | T4 (signatures unchanged), T5 (diff check)                                               |
| NFR-4 Telemetry constraints                                                           | T0 (verification gate)                                                                   |
| NFR-5 Enrichment overhead (sync, suppression preserved)                               | T2 (§4.3), T1 retained suppression tests                                                 |
| AC-1..AC-10                                                                           | AC-10 → T0; AC-1/2/3/4 → T3+T4; AC-5 → T1+T2; AC-6 → T2/T4/T5; AC-7/8/9 → T5; AC-10 → T0 |
| FR-7 `X-App-Version` header on all frontend API requests (scope extension)            | T6 (RED), T7 (GREEN §14)                                                                 |

## Test files summary

| Test file                                               | Action                     | Coverage                                                                                                           |
| ------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `apps/mobile/src/utils/__tests__/logger.test.ts`        | Existing — update + extend | Wrapper enrichment (all levels, trailing object, passthrough, no-args, undefined), production suppression retained |
| `apps/mobile/src/services/__tests__/analytics.test.ts`  | Existing — update          | Native/web `trackEvent` exact params, native Crashlytics attribute, web console-error line                         |
| `apps/mobile/src/services/__tests__/api-client.test.ts` | Existing — extend          | `X-App-Version` header on ApiClient requests and `fetchWithDeviceId` (FR-7)                                        |

## Dependency graph (task-level)

```
T0 (doc verification) → T1 (RED logger) → T2 (GREEN logger) → T3 (RED analytics) → T4 (GREEN analytics) → T5 (gate) → P1 (review) → P2 (PR)
```

## Rollback boundaries

| Stage        | Rollback boundary                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Whole change | Single revert of the 5 files (2 services + 1 wrapper + 2 test files). No migrations, no schema, no env/config changes, no new dependencies. |
