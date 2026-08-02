# Analytics App Version Enrichment — Specification

**Change:** `analytics-app-version`
**Status:** Specification

---

## 1. Functional Requirements

### FR-1 Analytics events carry `app_version` (native + web)

The system MUST include an `app_version` param in every analytics event dispatched through `trackEvent`, on both platforms:

- **Native** — `apps/mobile/src/services/analytics.ts`
- **Web** — `apps/mobile/src/services/analytics.web.ts`

The `app_version` param MUST be added to the same `extendedParams` object that already carries `platform: Platform.OS`, so that both dispatch paths carry it: the Firebase `logEvent` payload and the console-fallback paths (which log `extendedParams` directly). This single enrichment point MUST cover all 20+ `trackEvent` call sites (root layout, purchase, geofence, network, download, location, audio-player flows) without modifying any call site.

The param MUST be named `app_version` (snake_case, matching existing params such as `track_id`, `error_msg`, `position_ms`).

#### Scenario: Native trackEvent params include app_version

- GIVEN `getAppVersion()` is mocked to return `{ versionName: 'test-version' }` and Firebase Analytics is available
- WHEN `trackEvent('test_event', { foo: 'bar' })` runs on iOS
- THEN `logEvent` is called with `('test_event', { foo: 'bar', platform: 'ios', app_version: 'test-version' })`

#### Scenario: Native console fallback logs app_version

- GIVEN `getAppVersion()` is mocked to return `{ versionName: 'test-version' }` and Firebase modules are unavailable (console-fallback path)
- WHEN `trackEvent('test_event', { foo: 'bar' })` runs on native
- THEN the fallback log line includes the full `extendedParams` object
- AND that object contains `app_version: 'test-version'`

#### Scenario: Web trackEvent params include app_version

- GIVEN `getAppVersion()` is mocked to return `{ versionName: 'test-version' }` and the Firebase Web SDK is available
- WHEN `trackEvent('test_web_event', { foo: 'web_bar' })` runs on web
- THEN the web `logEvent` is called with params `{ foo: 'web_bar', platform: 'web', app_version: 'test-version' }`

#### Scenario: Web console fallback logs app_version

- GIVEN `getAppVersion()` is mocked to return `{ versionName: 'test-version' }` and the Firebase Web SDK is unavailable
- WHEN `trackEvent('test_web_event', { foo: 'web_bar' })` runs on web
- THEN the console-fallback line includes `extendedParams` containing `app_version: 'test-version'`

#### Scenario: Event call sites and event map types are unchanged

- GIVEN the enrichment is centralized in `trackEvent`
- WHEN inspecting the 20+ event call sites and the event map types
- THEN no call site and no event map type is modified by this change

---

### FR-2 Native `recordError` attaches an `app_version` Crashlytics attribute

When Crashlytics is available, native `recordError` (in `apps/mobile/src/services/analytics.ts`) MUST call `setAttribute('app_version', getAppVersion().versionName)` alongside the existing `setAttribute('custom_description', …)`. The attribute MUST be set on the same session as the recorded error (Crashlytics attributes are session-scoped). The `recordError(error, description)` signature MUST NOT change.

#### Scenario: Crashlytics attribute set alongside custom_description

- GIVEN `getAppVersion()` is mocked to return `{ versionName: 'test-version' }` and Crashlytics is available
- WHEN `recordError(error, 'download failed')` runs on native
- THEN `setAttribute` is called with `('custom_description', 'download failed')`
- AND `setAttribute` is called with `('app_version', 'test-version')`
- AND `recordError(error)` is still called with the original error

#### Scenario: Native console fallback path carries the version

- GIVEN Firebase/Crashlytics modules are unavailable (native console-fallback path)
- WHEN `recordError(error, 'download failed')` runs on native
- THEN the fallback `logger.error(...)` line carries the `app_version` metadata object via the mobile logger wrapper (FR-4)

---

### FR-3 Web `recordError` console output includes the version

The console error line emitted by web `recordError` (`apps/mobile/src/services/analytics.web.ts`) MUST include an `app_version` metadata object. The requirement is on the observable output, not the mechanism: the default mechanism is the mobile logger wrapper (FR-4); if the design rejects the wrapper, the explicit fallback appends the version as an argument to the `logger.error` call. Under either mechanism the version MUST appear exactly once in the line (no duplicate explicit argument when the wrapper already appends it). The `recordError(error, description)` signature MUST NOT change.

#### Scenario: Web error console line carries app_version

- GIVEN `getAppVersion()` is mocked to return `{ versionName: 'test-version' }` and a `console.error` spy is installed
- WHEN `recordError(error, 'web failure')` runs on web
- THEN the console error line includes the `[Web Error]` message, the error, the description
- AND the line carries an `app_version: 'test-version'` metadata object

---

### FR-4 Mobile logger enriches every console line with `app_version`

`apps/mobile/src/utils/logger.ts` MUST stop being a pure re-export and MUST append a trailing `{ app_version: getAppVersion().versionName }` metadata object to every log call (`debug`, `info`, `warn`, `error`). The enrichment MUST happen only at this mobile boundary — never inside `packages/shared/src/utils/logger.ts`.

Enrichment shape (mandatory): a trailing metadata object appended after the caller's arguments — NOT a text prefix. This keeps message text untouched and is consistent with existing metadata-arg usage:

- `logger.info('msg')` → `[INFO] msg { app_version: '1.4.2' }`
- `logger.info('request failed', meta)` → `[INFO] request failed meta { app_version: '1.4.2' }`

The exported interface MUST remain `{ debug, info, warn, error }` with signatures matching `console.*` conventions (unchanged from today), so the 20+ existing consumers keep working without modification.

#### Scenario: every level is enriched

- GIVEN `getAppVersion()` is mocked to return `{ versionName: 'test-version' }`
- WHEN `logger.debug('d')`, `logger.info('i')`, `logger.warn('w')`, and `logger.error('e')` are called
- THEN each resulting console line ends with a trailing `{ app_version: 'test-version' }` object

#### Scenario: metadata passthrough is preserved

- GIVEN `getAppVersion()` is mocked to return `{ versionName: 'test-version' }`
- WHEN `logger.info('request failed', { status: 500 })` is called
- THEN the console line contains the original message and the original metadata object `{ status: 500 }`
- AND ends with the trailing `{ app_version: 'test-version' }` object

#### Scenario: no-args call emits trailing metadata

- GIVEN `getAppVersion()` is mocked to return `{ versionName: 'test-version' }`
- WHEN `logger.info()` is called with no arguments
- THEN the console line is `[INFO] { app_version: 'test-version' }` (deliberate, documented behavior change)

#### Scenario: undefined args are enriched

- GIVEN `getAppVersion()` is mocked to return `{ versionName: 'test-version' }`
- WHEN `logger.info('msg', undefined)` is called
- THEN the console line carries the message
- AND ends with the trailing `{ app_version: 'test-version' }` object

#### Scenario: exported interface is unchanged

- GIVEN the mobile logger module is imported
- WHEN checking its exports
- THEN it exposes exactly `debug`, `info`, `warn`, and `error`
- AND every existing mobile consumer of `@/utils/logger` compiles and behaves without modification

---

### FR-5 Version value semantics

The version reported in all enriched outputs MUST be the app version name baked at build time — the semver `APP_VERSION_NAME` (e.g. `1.4.2`) — as exposed by the existing, tested `getAppVersion().versionName` helper. Requirements:

- **Version name only**: the value MUST be the version name, NOT the build number (`APP_VERSION_CODE` / `versionCode` is explicitly excluded).
- **Single source of truth**: the reported value MUST equal what the splash screen and home screen display (`getAppVersion().versionName` consumers), so telemetry matches what the user sees.
- **Source-agnostic spec of the design fork**: the design phase resolves which runtime read backs `getAppVersion()` on native (`Application.nativeApplicationVersion` vs `extra.appVersionName`); the spec requires only that the value reported is the `APP_VERSION_NAME` baked at build time. Production accuracy is identical under either choice; the fork affects only Expo Go dev sessions.
- **Fallback convention retained**: the existing `'0.0.0'` defensive fallback in `getAppVersion()` MUST NOT be changed and no new fallback MUST be invented. A missing version is effectively impossible in real builds (`app.config.ts` throws without `APP_VERSION_NAME`).

#### Scenario: telemetry carries the mocked version in tests

- GIVEN `jest.mock('@/utils/app-version', () => ({ getAppVersion: () => ({ versionName: 'test-version', formatted: 'test-version' }) }))`
- WHEN analytics events, error records, and logger calls are exercised
- THEN every enriched output carries `app_version: 'test-version'` (deterministic regardless of jest module resolution)

#### Scenario: version name only, build number excluded

- GIVEN a build with `APP_VERSION_NAME=1.4.2` and a distinct versionCode
- WHEN telemetry is produced
- THEN `app_version` is `1.4.2`
- AND no build number appears in any `app_version` value

#### Scenario: fallback convention unchanged

- GIVEN `getAppVersion()` returns the `'0.0.0'` fallback (only reachable in edge cases/tests, unreachable in real builds)
- WHEN enriched outputs are produced
- THEN `app_version` is `'0.0.0'` (no new fallback value, no error path added)

---

### FR-7 Every frontend API request carries the app version header

Every HTTP request leaving the mobile frontend MUST include an `X-App-Version` header with the app version name. This covers the centralized `ApiClient` (via `MobileApiClient.getAuthHeader()` in `apps/mobile/src/services/api-client.ts`, which already injects `X-Device-Id` and `X-Device-Platform`) AND the raw `fetchWithDeviceId()` path used for audio cache-busting. The header value MUST be `getAppVersion().versionName` (same single source as FR-5). `packages/shared/src/api/base-client.ts` MUST NOT be modified (the header injection happens at the mobile boundary).

#### Scenario: all ApiClient requests carry X-App-Version

- GIVEN `getAppVersion()` is mocked to return `{ versionName: 'test-version' }` and `getDeviceId()` resolves
- WHEN `ApiClient.get/post/put/patch/delete` performs any request
- THEN the outgoing `fetch` call includes headers with `X-App-Version: 'test-version'` alongside `X-Device-Id` and `X-Device-Platform`

#### Scenario: fetchWithDeviceId carries X-App-Version

- GIVEN `getAppVersion()` is mocked and `getDeviceId()` resolves
- WHEN `ApiClient.fetchWithDeviceId(url)` performs a raw fetch
- THEN the outgoing `fetch` call includes `X-App-Version: 'test-version'` in its headers

#### Scenario: shared base client untouched

- GIVEN the change is implemented
- WHEN diffing `packages/shared/` against the branch base
- THEN `packages/shared/src/api/base-client.ts` has no change (backend/API isolation, NFR-1)

---

### FR-6 Tests updated and added (strict TDD, same change)

The test suite MUST be updated and extended in the same change, per strict TDD (`make validate`):

- **`apps/mobile/src/services/__tests__/analytics.test.ts`**:
  - Add `jest.mock('@/utils/app-version', …)` returning `{ versionName: 'test-version', formatted: 'test-version' }`
  - Update the native exact-param assertion (currently `:64`) to `{ foo: 'bar', platform: 'ios', app_version: 'test-version' }`
  - Update the web exact-param assertion (currently `:81`) to include `app_version: 'test-version'`
  - Add `expect(mockSetAttribute).toHaveBeenCalledWith('app_version', 'test-version')` to the native `recordError` test (currently `:70-73`)
  - Update the web console-error assertion (currently `:88-97`) for the wrapper-appended metadata
- **`apps/mobile/src/utils/__tests__/logger.test.ts`**:
  - Mock `@/utils/app-version` for determinism
  - Update every exact console-arg assertion to include the trailing `{ app_version: 'test-version' }` object
  - Update the no-args case (`[INFO]` → `[INFO] { app_version: … }`) and the `undefined`-args case
  - Add a focused test asserting every level is enriched with `app_version`
  - Add a regression test asserting production suppression still holds (`debug`/`info` suppressed when `__DEV__` is false; `warn`/`error` always emit)

#### Scenario: updated assertions are exact

- GIVEN the mocked version is `'test-version'`
- WHEN the analytics and logger test suites run
- THEN every exact-argument assertion matches the enriched output including `app_version: 'test-version'`
- AND no assertion relies on the real `APP_VERSION_NAME`

#### Scenario: full suite is green

- GIVEN the implementation and tests are complete
- WHEN `make validate` runs
- THEN the full suite passes, including the API suite (backend isolation, NFR-1)

---

## 2. Non-Functional Requirements

### NFR-1 Backend isolation

`packages/shared/src/utils/logger.ts` MUST remain byte-identical to today. Enrichment MUST be confined to `apps/mobile` (`analytics.ts`, `analytics.web.ts`, `src/utils/logger.ts`, `api-client.ts` and their tests).

**Documented exception (user-approved, 2026-08-02):** the single CORS allowlist file `apps/api/src/middleware/cors.ts` MAY add `X-App-Version` to `DEFAULT_HEADERS` (with its test in `cors.test.ts`), because without it the browser CORS preflight rejects web requests carrying the new header. This is the ONLY permitted `apps/api` change. API log output MUST be byte-identical to today, and the API test suite (including the logger spies in `apps/api/src/__tests__/payments.test.ts:400-401`) MUST still pass.

#### Scenario: shared logger and API untouched

- GIVEN the change is implemented
- WHEN diffing `packages/shared/` and `apps/api/` against the branch base
- THEN there is no change to `packages/shared/src/utils/logger.ts` or any `apps/api` file
- AND the API test suite passes unchanged

#### Scenario: mobile logs are the only enriched logs

- GIVEN a mobile `logger.info('x')` call and an API `logger.info('y')` call
- WHEN both run
- THEN the mobile console line carries `{ app_version: … }`
- AND the API console line is unchanged (`[INFO] y`, no version object)

### NFR-2 No new dependencies

The change MUST NOT add any dependency. `expo-application@56.0.3` and `expo-constants@56.0.21` are already installed and MUST be reused; the existing `getAppVersion()` helper MUST be reused as-is (not reimplemented).

### NFR-3 No changes to call sites, event map types, or build config

The change MUST NOT modify: the 20+ `trackEvent`/`recordError` call sites, the event map types (`AnalyticsEventMap`), `app.config.ts`, `packages/shared/src/api/base-client.ts`, or `apps/mobile/src/utils/app-version.ts` / `app-version.native.ts`.

### NFR-4 Telemetry constraints

The `app_version` param/attribute MUST satisfy the Firebase Analytics and Crashlytics constraints: param name `app_version` (11 chars) is well under the 40-char limit, values are semver version names (well under the 100-char value limit), `app_version` is not a Firebase reserved param name, and the Crashlytics `setAttribute` key/value limits are trivially satisfied. The Expo v56 documentation verification items listed in the proposal (§7) MUST pass in design/apply before any code is written.

### NFR-5 Enrichment overhead

Enrichment MUST be synchronous and non-blocking: `getAppVersion()` is a synchronous getter evaluated once per enriched call; no async path, no I/O, and no lazy evaluation are required. Environment-aware suppression behavior MUST be preserved (production suppresses `debug`/`info`; `warn`/`error` always emit).

---

## 3. Acceptance Criteria

1. **Native `trackEvent` payloads carry `app_version`** — updated exact assertion (`analytics.test.ts:64`): `logEvent` receives `{ foo: 'bar', platform: 'ios', app_version: 'test-version' }`; the native console-fallback line logs `extendedParams` including `app_version`.
2. **Web `trackEvent` payloads carry `app_version`** — updated exact assertion (`analytics.test.ts:81`): web `logEvent` receives `app_version: 'test-version'` alongside `platform: 'web'`; the web console-fallback line includes it too.
3. **Native `recordError` sets the Crashlytics attribute** — `setAttribute('app_version', 'test-version')` is asserted alongside `setAttribute('custom_description', …)` when Crashlytics is available.
4. **Web `recordError` console output includes the version** — the web error console line carries an `app_version` metadata object (via the mobile logger wrapper or the explicit-arg fallback), exactly once.
5. **Every mobile `logger.*` line carries the version** — all four levels append a trailing `{ app_version: … }` metadata object; the no-args case emits `[INFO] { app_version: … }`; metadata passthrough and `undefined`-args cases are covered by updated tests.
6. **Version value semantics** — reported value is the version name only (`getAppVersion().versionName`), equal to what the splash/home screen display; no build number; `'0.0.0'` fallback convention unchanged; no new fallback invented.
7. **Backend isolation** — `packages/shared` byte-identical after the change; `apps/api` unchanged except the documented CORS allowlist exception (X-App-Version, user-approved); API logs unchanged; API suite green.
8. **No scope creep** — no new dependencies; no changes to the 20+ call sites, event map types, `app.config.ts`, or the `app-version` helpers.
9. **`make validate` passes** — updated `analytics.test.ts` and `logger.test.ts` plus the full suite are green.
10. **Expo v56 doc verification passes before code** — the four verification items (expo-application, expo-constants, Firebase `logEvent` constraints/reserved names, Crashlytics `setAttribute` limits) are confirmed in design/apply before any implementation.

---

## 4. Files Modified / Created

| File                                                   | Action   | Change Summary                                                                                                                                               |
| ------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/mobile/src/services/analytics.ts`                | Modified | Import `getAppVersion`; add `app_version` to `extendedParams` in `trackEvent`; add `setAttribute('app_version', …)` in `recordError`                         |
| `apps/mobile/src/services/analytics.web.ts`            | Modified | Import `getAppVersion`; add `app_version` to `extendedParams` in `trackEvent`; web `recordError` version carried via logger wrapper (FR-3)                   |
| `apps/mobile/src/utils/logger.ts`                      | Modified | Replace pure re-export with enrichment wrapper appending `{ app_version }`; same exported interface `{ debug, info, warn, error }`                           |
| `apps/mobile/src/services/__tests__/analytics.test.ts` | Modified | Mock `@/utils/app-version`; update exact param assertions (`:64`, `:81`); add `setAttribute('app_version', …)` assertion; update web console-error assertion |
| `apps/mobile/src/utils/__tests__/logger.test.ts`       | Modified | Mock `@/utils/app-version`; update all exact console-arg assertions; add enrichment + production-suppression tests                                           |

**Not touched**: `packages/shared/src/utils/logger.ts`, all `apps/api` files, the 20+ event call sites, the event map types, `app.config.ts`, `app-version.ts`, `app-version.native.ts`.

---

## 5. Assumptions and Risks

| Assumption / Risk                                                                                                                                 | Impact                                                                               | Mitigation                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Expo Go dev reports Expo Go's binary version** via `Application.nativeApplicationVersion` (native `getAppVersion()` fork)                       | Low (dev-only traffic)                                                               | Production builds are accurate; the design phase resolves `native` vs `extra.appVersionName`; dashboards can filter dev traffic by `platform`/`app_version`                                                                                                                                                                 |
| **`'0.0.0'` fallback** when version is missing                                                                                                    | Low (unreachable in real builds — `app.config.ts` throws without `APP_VERSION_NAME`) | Existing convention retained; no new fallback invented (FR-5)                                                                                                                                                                                                                                                               |
| **Console noise**: every mobile log line gains a trailing metadata object                                                                         | Medium (accepted per user decision)                                                  | Prod shows only `warn`/`error` (shared suppression) — the version rides on the lines that matter; dev is where the version is most useful                                                                                                                                                                                   |
| **Double `app_version` on AnalyticsService fallback lines** (wrapper appends to lines that already log `extendedParams` containing `app_version`) | Low (console-only, dev-mostly)                                                       | Accepted; keeps fallback lines structurally identical to the Firebase payload; optional dedupe deferred (future consideration)                                                                                                                                                                                              |
| **Backend pollution** via accidental shared-logger modification                                                                                   | Medium                                                                               | Enrichment confined to `apps/mobile`; `packages/shared` byte-identical (NFR-1); API logger spies guard regressions                                                                                                                                                                                                          |
| **Web/native drift** (one platform updated, other missed)                                                                                         | Low                                                                                  | Both service files changed in the same PR; same helper import; exact-assertion tests on both platforms                                                                                                                                                                                                                      |
| **Existing exact-assertion tests break** (`analytics.test.ts`, `logger.test.ts`)                                                                  | Certain (deliberate)                                                                 | Updated in the same change per strict TDD; assertions are the spec (FR-6)                                                                                                                                                                                                                                                   |
| **Domain inference (no `Capabilities` section in proposal)**                                                                                      | Informational                                                                        | Domains inferred from affected areas: `analytics-tracking` (no canonical spec — new domain content) and `logger` (canonical `openspec/specs/logger/spec.md` exists); this spec is delivered as the change-level flat `spec.md` per delegation, following the archived `2026-07-29-sec-api-mobile-security-hardening` format |
