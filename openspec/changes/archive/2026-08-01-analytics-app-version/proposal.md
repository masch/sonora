# Analytics App Version Enrichment — Proposal

**Change:** `analytics-app-version`
**Status:** Proposal

---

## 1. Executive Summary

Every activity log registered from the Sonora frontend must include the app version, so that telemetry can be correlated with the release that produced it. All frontend activity logs already funnel through two central objects — `AnalyticsService.trackEvent` and `AnalyticsService.recordError` (`apps/mobile/src/services/analytics.ts` native / `analytics.web.ts` web) — which already inject `platform: Platform.OS` into every event. That is the single enrichment point to extend.

Per explicit user decision (scope: **todos** — all three categories), this change covers:

1. **Analytics events** (`trackEvent`, native + web): inject `app_version: getAppVersion().versionName` into `extendedParams` next to `platform` — covers all 20+ event call sites and both console-fallback log paths in one edit per platform.
2. **Error records** (`recordError`): native Crashlytics `setAttribute('app_version', …)` alongside the existing `custom_description` attribute; web console error output carries the version.
3. **Console logs from the mobile logger**: enrich at the mobile-only boundary (`apps/mobile/src/utils/logger.ts` wrapper) so every `logger.*` console line from the app carries an `app_version` metadata object. `packages/shared/src/utils/logger.ts` is **not** modified — the API consumes it, and backend logs must not be polluted with a frontend version.

The version value is the **version name only** (semver `APP_VERSION_NAME`, e.g. `1.4.2`) — not the build number. A tested, cross-platform `getAppVersion()` helper already exists (`utils/app-version.ts` web / `app-version.native.ts` native) with the established `'0.0.0'` defensive fallback (APP_VERSION_NAME is required at build time; `app.config.ts` throws without it, so the fallback is a convention, not a real path).

The change is small, additive, and single-PR: 2 service files + 1 logger wrapper + 3 test files, ~40–60 lines.

---

## 2. Goals & Non-goals

### Goals

- **All analytics events carry the version**: every `trackEvent` call (native + web, 20+ call sites) sends `app_version` in its params — both the Firebase `logEvent` payload and the console-fallback paths (which log `extendedParams` directly)
- **Errors carry the version**: native `recordError` attaches an `app_version` Crashlytics attribute alongside `custom_description`; web `recordError` console output includes the version
- **Mobile console logs carry the version**: every log emitted through the mobile logger (`@/utils/logger`) appends an `app_version` metadata object
- **Version name only**: the semver `APP_VERSION_NAME` (e.g. `1.4.2`), reusing the tested `getAppVersion().versionName` helper — no build number
- **Backend isolation**: `packages/shared` logger and all `apps/api` logs remain byte-identical to today
- **Tests**: update exact param assertions in `analytics.test.ts` and `logger.test.ts`; add tests for the logger enrichment (strict TDD, `make validate`)

### Non-goals

- **Minimum-version enforcement** — the archived `2026-07-02-app-version-check` scope (runtime version gates, block/warn UI, grace period) is deliberately not included; this change only _reports_ the version, it never _enforces_ against it
- **Splash/UI version display changes** — the archived `2026-07-26-splash-version` scope; existing consumers (`animated-icon`, `app-version-text`) keep working unchanged
- **Build number** — `APP_VERSION_CODE` / versionCode is explicitly excluded (user decision: version name only)
- **Backend/API logs** — no version enrichment anywhere in `apps/api` or `packages/shared`
- **Raw `console.*` calls bypassing the logger** — no production call sites use raw console methods today (only tests spy on them); those are out of scope
- **New dependencies** — `expo-application` and `expo-constants` are already installed and verified against SDK 56 package types
- **Changing the 20+ event call sites or the event map types** — enrichment is centralized in the service, not spread across call sites

---

## 3. Current State

### 3.1 One central enrichment point per platform

Both `trackEvent` implementations already build `extendedParams = { ...params, platform: Platform.OS }` and dispatch it to Firebase (`logEvent`) or the console fallback:

- **Native** (`apps/mobile/src/services/analytics.ts`): `trackEvent` `:84-99`, `recordError` `:101-113` (Crashlytics `setAttribute('custom_description', …)` + `recordError(error)`); Firebase modules loaded via dynamic `require` inside try/catch (present only in dev/prod builds, not Expo Go)
- **Web** (`apps/mobile/src/services/analytics.web.ts`): `trackEvent` `:86-104` (same `extendedParams` pattern, Firebase Web SDK or console fallback), `recordError` `:105-111` (console-only `logger.error('[Web Error]', …)`)

Adding `app_version` to `extendedParams` in both `trackEvent` implementations covers every event registration and both console-fallback paths. `recordError` needs its own treatment (Crashlytics attribute vs. web console output).

**Param naming**: existing event params use snake_case (`track_id`, `error_msg`, `position_ms`) → the new param is `app_version`.

### 3.2 `getAppVersion()` already exists and is tested

Created by the archived `2026-07-26-splash-version` change, with a `[platform]` split:

- **`apps/mobile/src/utils/app-version.ts`** (web; jest-resolved default): reads `Constants.expoConfig?.extra?.appVersionName ?? '0.0.0'`
- **`apps/mobile/src/utils/app-version.native.ts`** (iOS/Android): reads `Application.nativeApplicationVersion || '0.0.0'` from `expo-application`
- Both return `{ versionName, formatted }` (currently identical values)

`app.config.ts` requires `APP_VERSION_NAME` at build time (guard `:30-36` throws without it), bakes it into `version` (`:43`) and injects it as `extra.appVersionName` (`:131`). `expo-application@56.0.3` and `expo-constants@56.0.21` are installed; no new dependencies.

### 3.3 Shared logger boundary (critical constraint, verified)

- `packages/shared/src/utils/logger.ts` — plain console logger (`[LEVEL]` prefixes, `__DEV__`-aware suppression)
- `apps/mobile/src/utils/logger.ts` — **pure re-export**: `export { logger } from '@sonora/shared'`
- The shared logger is **also consumed by the API**: `apps/api/src/lib/http-client.ts`, `apps/api/src/payments/mercadopago.ts`, `apps/api/src/scripts/migrations/migrate-cli.ts`; API tests spy on it (`apps/api/src/__tests__/payments.test.ts:400-401`)
- Verified: **no file in `apps/mobile` imports `{ logger }` from `@sonora/shared` directly** — `src/utils/logger.ts` is the single mobile logger boundary, and every one of the 20+ mobile consumers already goes through it
- Conclusion: version enrichment for console logs must happen at `apps/mobile/src/utils/logger.ts`, never inside `packages/shared`

### 3.4 Existing tests that this change will touch (verified)

- `apps/mobile/src/services/__tests__/analytics.test.ts` — exact param assertions:
  - `:64` `expect(mockLogEvent).toHaveBeenCalledWith('test_event', { foo: 'bar', platform: 'ios' })`
  - `:81` web variant: `expect(mockWebLogEvent).toHaveBeenCalledWith(expect.any(Object), 'test_web_event', { foo: 'web_bar', platform: 'web' })`
  - `:70-73` native `recordError` test (asserts `custom_description`; gains an `app_version` assertion)
  - `:88-97` web console error test (spies on `console.error`, asserts exact args)
- `apps/mobile/src/utils/__tests__/logger.test.ts` — **exists today and asserts exact console args** for every level, the no-args case (`expect(spy).toHaveBeenCalledWith('[INFO]')`), `undefined` args, and metadata passthrough. The wrapper enrichment breaks these assertions deliberately; they must be updated in the same change
- Mock patterns available: `jest.mock('@/utils/app-version', () => ({ getAppVersion: () => ({ versionName: 'test-version', formatted: 'test-version' }) }))` keeps assertions deterministic regardless of jest's module resolution (under jest, `@/utils/app-version` resolves to the expo-constants web variant)

---

## 4. Proposed Solution

### 4.1 `trackEvent` enrichment (native + web)

In both `apps/mobile/src/services/analytics.ts` and `apps/mobile/src/services/analytics.web.ts`, extend the existing `extendedParams` construction:

```ts
const extendedParams = {
  ...params,
  platform: Platform.OS,
  app_version: getAppVersion().versionName,
};
```

One import per file (`import { getAppVersion } from '@/utils/app-version';`). This covers every event in the `AnalyticsEventMap` (20+ call sites across layouts, purchase, geofence, network, download, location, and audio-player flows) plus both console-fallback paths, which log `extendedParams` directly. `app_version` is a short, non-reserved Firebase param name (≤ 40 chars, value ≤ 100 chars limits are trivially satisfied; reserved-name collision check is part of the Expo v56 doc verification in §7 below).

### 4.2 `recordError` — native Crashlytics attribute

In `apps/mobile/src/services/analytics.ts`, alongside the existing `custom_description` attribute:

```ts
firebaseCrashlytics().setAttribute('app_version', getAppVersion().versionName);
```

`setAttribute` is session-scoped (persists for the Crashlytics session). The console fallback path (`logger.error('[Native Error - Disabled]', error, customDescription)`) carries the version automatically via the logger wrapper (4.4).

### 4.3 `recordError` — web console output carries the version

The web `recordError` (`analytics.web.ts:105-111`) is console-only: `logger.error('[Web Error]', error, customDescription)`. With the logger wrapper from 4.4 in place, **every** console line from the mobile logger — including this one — carries the `app_version` metadata object, satisfying "web console error args include the version" without a signature change.

**Design-time decision flag**: if design rejects the wrapper (see 5.4), the explicit fallback is to append the version directly in the web call: `logger.error('[Web Error]', error, customDescription, { app_version: getAppVersion().versionName })`. Default scope is: wrapper covers it, no duplicate explicit arg (avoids the version appearing twice on the line). The user-facing requirement — the version is present in web error console output — holds under either mechanism.

### 4.4 Mobile logger wrapper enrichment (user decision: "todos")

`apps/mobile/src/utils/logger.ts` stops being a pure re-export and becomes a thin, mobile-only enrichment wrapper. This is the only mobile indirection point for logging — every `logger.*` call in the app flows through it, and the API cannot reach it (the API imports `@sonora/shared` directly).

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

**Enrichment shape** — trailing metadata object, not a text prefix:

- `logger.info('msg')` → `[INFO] msg { app_version: '1.4.2' }`
- `logger.info('request failed', meta)` → `[INFO] request failed meta { app_version: '1.4.2' }`
- Consistent with how the codebase already passes metadata objects (see `logger.test.ts` 'request failed' pattern); programmatically parseable; does not alter message text (a `[v1.4.2]` prefix would be grep-able but pollutes the message itself)

**Noise tradeoff** (explicit, accepted per user decision):

- In production, the shared logger suppresses `debug`/`info`; only `warn`/`error` lines are visible — the version rides on exactly the lines that matter in prod
- In dev (`__DEV__`), every console line gains one trailing object — acceptable dev noise; the version is exactly what a dev debugging against a backend wants to see
- Known interaction: the `AnalyticsService` console-fallback paths log `extendedParams` (which now includes `app_version`), and the wrapper appends another `{ app_version }` → the line carries the version twice. Accepted (console-only, dev-mostly); design may dedupe if it wants, but the extra object is harmless and keeps the fallback line structurally identical to the Firebase payload
- Cost: `getAppVersion()` is a synchronous getter evaluated once per log call, including production-suppressed levels — negligible; no lazy evaluation needed

**Boundary guarantee**: `packages/shared` is untouched; the API's console output cannot change.

### 4.5 Tests (strict TDD — tests updated/added in the same change)

| File                                                   | Change                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/src/services/__tests__/analytics.test.ts` | Add `jest.mock('@/utils/app-version', …)` returning `'test-version'`; update `:64` to `{ foo: 'bar', platform: 'ios', app_version: 'test-version' }`; update `:81` web variant similarly; add `expect(mockSetAttribute).toHaveBeenCalledWith('app_version', 'test-version')` to the native `recordError` test; update the web console-error assertion (`:88-97`) for the wrapper-appended metadata |
| `apps/mobile/src/utils/__tests__/logger.test.ts`       | Update every exact console-arg assertion to include the trailing `{ app_version: … }` object (mock `@/utils/app-version` for determinism); update no-args (`[INFO]` → `[INFO] { app_version: … }`) and `undefined` cases; add a focused "enriches every level with app_version" test and a "production suppression still holds" regression test                                                    |

Test conventions follow explore §5: co-located tests, `jest-expo` preset, `moduleNameMapper @/* → src/*`, module mocks (`jest.mock('@/utils/app-version', …)`) for deterministic version values.

---

## 5. Key Design Decisions

### 5.1 Version source: `getAppVersion()` as-is (recommended) vs `extra.appVersionName` everywhere

**Recommendation: reuse `getAppVersion().versionName` as-is.** Final call delegated to design.

| Source                            | Native prod build             | Native Expo Go dev               | Web                                      | Notes                                                   |
| --------------------------------- | ----------------------------- | -------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `getAppVersion()` (as-is)         | `APP_VERSION_NAME` (accurate) | **Expo Go's own binary version** | `extra.appVersionName` via `.ts` variant | One tested helper; matches what splash/home screen show |
| `extra.appVersionName` everywhere | `APP_VERSION_NAME` (accurate) | `APP_VERSION_NAME` (accurate)    | `extra.appVersionName`                   | Second version source; drift risk; more code            |

Rationale for the recommendation:

1. **Consistency with what users see**: splash (`animated-icon`) and home screen (`app-version-text`) display `getAppVersion().versionName` — telemetry reports the same value the user is looking at, a single source of truth
2. **Production accuracy is identical either way**: in release builds `Application.nativeApplicationVersion` equals the `version` baked from `APP_VERSION_NAME` — the fork only affects **Expo Go dev sessions** (where `nativeApplicationVersion` reports Expo Go's binary version)
3. **Web requires the `extra` path regardless**: `nativeApplicationVersion` is `null` on web — the platform split already handles this
4. **Zero new code**: the helper is tested; `'0.0.0'` is the established defensive fallback convention (APP_VERSION_NAME is build-time-required, so this path is effectively unreachable in real builds)
5. Expo Go dev traffic is dev noise, filterable in dashboards by `platform`/`app_version`

### 5.2 Why the logger wrapper and not `packages/shared`

The shared logger is used by the API; enriching it would inject a frontend version into every backend log line (`http-client`, `mercadopago`, `migrate-cli`) and break API test spies. `apps/mobile/src/utils/logger.ts` is verified to be the **only** mobile entry point to the shared logger — 20+ mobile consumers import `@/utils/logger`, zero import `@sonora/shared` directly. It is the natural, airtight mobile boundary.

### 5.3 Enrichment shape: trailing metadata object

Chosen over a `[v1.4.2]` text prefix: consistent with existing metadata-arg usage, machine-parseable, and it keeps the message text untouched. The no-args edge case (`logger.info()`) now emits `[INFO] { app_version: … }` — a deliberate, documented behavior change covered by updated tests.

### 5.4 Wrapper adoption is the default scope; design may flag harm

The user explicitly chose "todos" for console logs. The proposal's default is the wrapper (4.4). If design finds it harmful (e.g., the double-`app_version` in `AnalyticsService` fallback lines, or the per-call getter cost is judged unacceptable), it must flag the decision with evidence and propose the minimal alternative — but the default stands unless design demonstrates a real problem. Under either outcome, requirement 2's "web console error args include the version" holds via 4.3's fallback.

### 5.5 Param name and value

- `app_version` (snake_case, matching existing params; short, non-reserved for Firebase Analytics)
- Value: `getAppVersion().versionName` (version name only — build number explicitly excluded by user decision; `formatted` is identical today, so `versionName` is unambiguous)

---

## 6. Risks & Mitigations

| Risk                                                                             | Likelihood                     | Impact | Mitigation                                                                                                                                                                  |
| -------------------------------------------------------------------------------- | ------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Expo Go dev reports Expo Go's version** via `nativeApplicationVersion`         | Certain (dev-only)             | Low    | Documented; production builds are accurate; dashboards can filter dev traffic by `platform`; design may prefer `extra.appVersionName` (5.1)                                 |
| **`'0.0.0'` fallback** when version missing (edge cases, tests)                  | Low                            | Low    | Existing convention; unreachable in real builds (`app.config.ts` throws without `APP_VERSION_NAME`); filterable                                                             |
| **Console noise**: every mobile log line gains a metadata object                 | Certain (dev) / limited (prod) | Medium | Accepted per user decision; prod only shows `warn`/`error` (shared suppression); single trailing object, parseable; dev is the environment where the version is most useful |
| **Backend pollution**: accidental shared-logger modification                     | Low                            | Medium | Enrichment only at `apps/mobile` wrapper + `AnalyticsService`; `packages/shared` untouched; API suite (`payments.test.ts` logger spies) guards regressions                  |
| **Web/native drift** (one platform updated, other missed)                        | Low                            | Low    | Both service files changed in the same PR; same helper import; exact-assertion tests on both platforms                                                                      |
| **Existing exact-assertion tests break** (`analytics.test.ts`, `logger.test.ts`) | Certain                        | Low    | Deliberate, updated in the same change per strict TDD; assertions are the spec                                                                                              |
| **Firebase/Crashlytics param limits or reserved names**                          | Low                            | Low    | `app_version` is 11 chars, value ≤ 100 chars; `setAttribute` key/value limits trivially satisfied; **verification against Expo v56 docs pending** (see §7)                  |

---

## 7. Pending Verification (design/apply, per AGENTS.md)

`AGENTS.md` mandates reading the exact versioned Expo docs before writing code. Exploration could not browse; these items are verified in **design/apply** (no code is written before they pass):

1. `expo-application` v56 — `nativeApplicationVersion` semantics, especially **Expo Go behavior** (returns Expo Go's version vs the app's) and null cases
2. `expo-constants` v56 — `expoConfig` availability on web and in Expo Go; `extra` passthrough
3. Firebase Analytics `logEvent` constraints (param count ≤ 25, name ≤ 40 chars, value ≤ 100 chars) and reserved-param list — confirm `app_version` is not reserved (it is not a standard reserved name; `platform` already in use today)
4. Crashlytics `setAttribute` key/value limits if the attribute route is kept

All four are expected to pass trivially; they are verification items, not open design questions.

---

## 8. First Slice

This change is small enough that everything is the first slice:

1. `trackEvent` enrichment in both `analytics.ts` and `analytics.web.ts`
2. Native `recordError` `app_version` Crashlytics attribute
3. Logger wrapper enrichment in `apps/mobile/src/utils/logger.ts`
4. Test updates/additions in `analytics.test.ts` and `logger.test.ts`

No deferrals. Single PR.

---

## 9. Future Considerations

- **Dashboard filtering**: once `app_version` flows to Firebase, dashboards can segment/filter by version (including excluding Expo Go dev traffic) — no code needed, but worth documenting in the analytics tooling
- **Console dedupe**: if the double `app_version` in `AnalyticsService` fallback lines is ever judged noisy, drop the appended object for those specific calls — a design-time micro-optimization, not required now
- **Version in API requests**: sending `app_version` as a request header (like `X-Device-Id`) is a natural extension but explicitly a **non-goal** here; it belongs to a future API observability change
- **Strict version gating**: the archived `app-version-check` minimum-version enforcement could later _consume_ the now-accurate `app_version` telemetry to drive rollout decisions — out of scope for this change

---

## 10. Technical Architecture

### Files touched

| File                                                   | Change                                                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/mobile/src/services/analytics.ts`                | Import `getAppVersion`; add `app_version` to `extendedParams` (`trackEvent`); add `setAttribute('app_version', …)` in `recordError`                          |
| `apps/mobile/src/services/analytics.web.ts`            | Import `getAppVersion`; add `app_version` to `extendedParams` (`trackEvent`); web `recordError` covered by logger wrapper (4.3)                              |
| `apps/mobile/src/utils/logger.ts`                      | Replace pure re-export with enrichment wrapper (4.4); same exported interface `{ debug, info, warn, error }`                                                 |
| `apps/mobile/src/services/__tests__/analytics.test.ts` | Mock `@/utils/app-version`; update exact param assertions (`:64`, `:81`); add `setAttribute('app_version', …)` assertion; update web console-error assertion |
| `apps/mobile/src/utils/__tests__/logger.test.ts`       | Mock `@/utils/app-version`; update all exact console-arg assertions; add enrichment + suppression regression tests                                           |

**Not touched**: `packages/shared/src/utils/logger.ts`, all `apps/api` files, the 20+ event call sites, the event map types, `app.config.ts`, `app-version.ts`/`app-version.native.ts`.

### Data flow

```
trackEvent(event, params)
  └─ extendedParams = { ...params, platform: Platform.OS, app_version: getAppVersion().versionName }
       ├─ Firebase logEvent (native/web)          → payload carries app_version
       └─ console fallback logger.info(…, extendedParams)
            └─ wrapper appends { app_version }    → dev console line

recordError(error, description)
  ├─ native: setAttribute('app_version', …) + recordError(error)  → Crashlytics session attribute
  └─ web: logger.error('[Web Error]', error, description)
       └─ wrapper appends { app_version }         → console error line

any logger.debug/info/warn/error(...) in apps/mobile
  └─ wrapper appends { app_version } → every mobile console line carries the version
```

### Success Criteria

1. Every `trackEvent` (native + web) sends `app_version` equal to `getAppVersion().versionName` in its params — verified by updated exact assertions for both Firebase `logEvent` and console-fallback paths
2. Native `recordError` sets the Crashlytics attribute `app_version` alongside `custom_description` when Crashlytics is available
3. Web `recordError` console output includes the version (via wrapper)
4. Every `logger.*` call in `apps/mobile` writes a trailing `{ app_version }` metadata object to the console
5. `packages/shared` and `apps/api` logs are byte-identical to today; API test suite still passes (no backend pollution)
6. `make validate` passes (updated `analytics.test.ts`, `logger.test.ts`, full suite green)
7. No new dependencies; no changes to event call sites, event map types, or `app.config.ts`
8. Expo v56 doc verification items (§7) pass before any code is written
