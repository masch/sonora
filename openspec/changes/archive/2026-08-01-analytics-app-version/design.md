# Analytics App Version Enrichment — Technical Design

**Change:** `analytics-app-version`
**Slice:** First (only slice — small, additive, single PR)
**Status:** Draft

---

## 1. Module Structure

### 1.1 File Inventory

| File                                                   | Action       | Change Summary                                                                                                                                       |
| ------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/src/services/analytics.ts`                | **Modified** | Import `getAppVersion`; add `app_version` to `extendedParams` in `trackEvent`; add `setAttribute('app_version', …)` in `recordError`                 |
| `apps/mobile/src/services/analytics.web.ts`            | **Modified** | Import `getAppVersion`; add `app_version` to `extendedParams` in `trackEvent`; web `recordError` unchanged (version carried by logger wrapper, FR-3) |
| `apps/mobile/src/utils/logger.ts`                      | **Modified** | Replace pure re-export with mobile-only enrichment wrapper; exported interface `{ debug, info, warn, error }` preserved                              |
| `apps/mobile/src/services/__tests__/analytics.test.ts` | **Modified** | Mock `@/utils/app-version`; update 4 exact assertions; add `setAttribute('app_version', …)` assertion                                                |
| `apps/mobile/src/utils/__tests__/logger.test.ts`       | **Modified** | Mock `@/utils/app-version`; update every exact console-arg assertion; add one focused enrichment test                                                |

**Not touched (NFR-1, NFR-2, NFR-3)**: `packages/shared/src/utils/logger.ts`, all `apps/api` files, the 20+ `trackEvent`/`recordError` call sites, `AnalyticsEventMap` and all event interfaces, `app.config.ts`, `apps/mobile/src/utils/app-version.ts`, `apps/mobile/src/utils/app-version.native.ts`. No new dependencies.

### 1.2 Module Responsibilities and Exports

```
app-version.ts / app-version.native.ts   — UNCHANGED. getAppVersion(): AppVersion
                                             ({ versionName, formatted }) — single version source of truth
analytics.ts (native)
  - trackEvent(eventName, params?)   — extendedParams gains app_version; unchanged signature
  - recordError(error, description?) — adds setAttribute('app_version', …); unchanged signature
  - initializeGlobalErrorTracking()  — unchanged
analytics.web.ts (web)
  - trackEvent(eventName, params?)   — extendedParams gains app_version; unchanged signature
  - recordError(error, description?) — UNCHANGED (wrapper covers FR-3)
  - initializeGlobalErrorTracking()  — unchanged

logger.ts (apps/mobile/src/utils/logger.ts)
  - export const logger { debug, info, warn, error } — same shape as today, each
    appending { app_version: getAppVersion().versionName } as trailing arg
```

Interface changes: **none.** `trackEvent`, `recordError`, and `logger` keep their exact current signatures; the 20+ call sites and consumers compile and behave unchanged.

### 1.3 Dependency Graph

```
app-version.ts (web) ─┐
app-version.native.ts ┤ (Metro [platform] resolution — UNCHANGED)
                      └── getAppVersion()
                             │
        ┌────────────────────┼──────────────────────┐
        ▼                    ▼                      ▼
analytics.ts (native)   analytics.web.ts       logger.ts (mobile wrapper)
        │                    │                      │
        ▼                    ▼                      ▼
@sonora/shared logger ←──────┴────── (mobile boundary — API imports @sonora/shared directly, never this wrapper)
```

No circular dependencies. The wrapper is the only mobile entry point to the shared logger (verified: zero mobile files import `{ logger }` from `@sonora/shared` directly); the API cannot reach it because the API imports `@sonora/shared` itself.

---

## 2. Design Decision 1 — Version Source (spec FR-5 fork, resolved)

### Decision: **Option (a) — reuse `getAppVersion().versionName` as-is. No helper changes, no parallel read.**

```ts
// services (both platforms) and logger wrapper — one import each:
import { getAppVersion } from '@/utils/app-version';
// value used everywhere: getAppVersion().versionName
```

### Why (b) `extra.appVersionName` everywhere is rejected

| Source                                    | Native prod build             | Native Expo Go dev            | Web                                    | Cost                                         |
| ----------------------------------------- | ----------------------------- | ----------------------------- | -------------------------------------- | -------------------------------------------- |
| **(a) `getAppVersion()` as-is**           | `APP_VERSION_NAME` (accurate) | Expo Go's own binary version  | `extra.appVersionName` (`.ts` variant) | Zero new code; one tested helper             |
| **(b) `extra.appVersionName` everywhere** | `APP_VERSION_NAME` (accurate) | `APP_VERSION_NAME` (accurate) | `extra.appVersionName`                 | Second version source; drift risk; more code |

1. **NFR-3 is a hard constraint that eliminates (b)**: the approved spec explicitly forbids modifying `apps/mobile/src/utils/app-version.ts` / `app-version.native.ts`. Option (b) implemented as "rewrite the native helper to read `extra.appVersionName`" is a direct NFR-3 violation. Option (b) implemented as "read `Constants.expoConfig?.extra?.appVersionName` directly inside the services" violates **FR-5's single source of truth** ("the reported value MUST equal what the splash screen and home screen display") — splash (`animated-icon.tsx`) and home (`app-version-text.tsx`) consume `getAppVersion()`, so a parallel read would report a different value than the UI on native in Expo Go, and would duplicate tested logic.
2. **Production accuracy is identical under both**: in release builds, `Application.nativeApplicationVersion` equals the `version` baked from `APP_VERSION_NAME` (`app.config.ts:43`), and `extra.appVersionName` is injected from the same env var (`app.config.ts:131`). The fork affects **only Expo Go dev sessions**.
3. **Consistency with what the user sees**: telemetry reports exactly the value the splash/home screen show — a single source of truth, per FR-5. In Expo Go dev, the splash screen shows Expo Go's version too, so telemetry and UI never disagree.
4. **Zero new code, established fallback**: the helper is tested (`app-version.test.ts`, `app-version.native.test.ts`); the `'0.0.0'` convention (FR-5) is retained unchanged; `app.config.ts:30-36` throws at build time without `APP_VERSION_NAME`, so the fallback is unreachable in real builds.
5. Expo Go dev traffic is dev noise, filterable in dashboards by `platform` / `app_version` (accepted, documented risk).

This matches the proposal's recommendation (§5.1) and the exploration's recommendation (§3). The spec's fork language ("the design phase resolves which runtime read backs `getAppVersion()`") is resolved as: **no change to the runtime read; both platform variants of the helper stay exactly as they are today.**

---

## 3. Design Decision 2 — Expo v56 Documentation Verification (AGENTS.md mandate, spec NFR-4 / AC-10)

**Verification method note**: the design phase has no browser/HTTP tool available. Verification was performed against the **installed SDK 56 package artifacts** (`expo-application@56.0.3`, `expo-constants@56.0.21`, `expo@56.0.16`, `@react-native-firebase/analytics@21.14.0`, `@react-native-firebase/crashlytics@21.14.0`, `firebase@11.3.1` — the exact versioned bytes that run in this app) plus the versioned docs pages referenced below. Package type declarations and source comments are the authoritative ground truth for the API surface used here. All four items **PASS**; the values used are so far below every limit that doc drift cannot invalidate the design. The AGENTS.md online-doc preflight remains a cheap re-confirmation step for apply if a browser is available.

### 3.1 expo-application v56 — `nativeApplicationVersion` semantics

**Verified (installed package, `apps/mobile/node_modules/expo-application/`):**

- `Application.d.ts:4-10`: `nativeApplicationVersion: string | null`; doc comment: "At time when native app is built, on Android, this is the version name set by `version` in app config, and on iOS, the `Info.plist` value for `CFBundleShortVersionString`. On web, this value is `null`."
- `Application.js:12-14`: `nativeApplicationVersion = ExpoApplication ? ExpoApplication.nativeApplicationVersion || null : null` — **null case confirmed** (also `''` coerces to `null`).
- `ExpoApplication.web.d.ts:4` / `ExpoApplication.web.js:8-10`: `readonly nativeApplicationVersion: null` on web — confirmed.

**Expo Go behavior**: the doc comment scopes the value to "the native app" — and in Expo Go, the running native binary **is Expo Go itself** (the app's own version is not baked into the Expo Go binary). Therefore in Expo Go dev the value is **Expo Go's binary version**, not `APP_VERSION_NAME`. This matches the exploration's finding and the proposal's risk table. No discrepancy — confirmed by the semantics, not contradicted by the v56 package artifacts.

**Result**: native prod builds accurate (versionName); Expo Go dev reports Expo Go's version (accepted, dev-only); `null` → `'0.0.0'` fallback via the existing helper.

### 3.2 expo-constants v56 — `expoConfig` availability and `extra` passthrough

**Verified (installed package, `apps/mobile/node_modules/expo-constants/build/Constants.types.d.ts`):**

- `:166-171`: `expoConfig: (ExpoConfig & { hostUri?: string }) | null` — "The standard Expo config object defined in **app.json** and **app.config.js** files. For both classic and modern manifests, whether they are embedded or remote." — i.e. **available on native, web, and in Expo Go** (Expo Go loads the app manifest from the dev server).
- `:174-175`: `expoGoConfig: ManifestsExpoGoConfig | null` — "populated when running in Expo Go" — Expo Go path confirmed as a distinct, populated field.
- `extra` passthrough: `extra` is a standard `ExpoConfig` field; this repo injects `extra.appVersionName` at `app.config.ts:131` and reads it at `app-version.ts:5` (`Constants.expoConfig?.extra?.appVersionName ?? '0.0.0'`). Cross-platform production precedent: `store/remote-config-store.ts:154` already reads `Constants.expoConfig?.version`.

**Result**: `expoConfig` (+ `extra.appVersionName`) works on web and in Expo Go — exactly what the web/`.ts` helper variant relies on. No discrepancy.

### 3.3 Firebase Analytics `logEvent` constraints and reserved names

**Verified (installed package, `apps/mobile/node_modules/@react-native-firebase/analytics/lib/index.d.ts` + `index.js`; `firebase@11.3.1` web SDK):**

- `index.d.ts:891-894`: `logEvent(name: string, params?: { [key: string]: any })` — params is a free-form object.
- `index.d.ts:870-872` (doc comment): "there are various limits that apply to event parameters (total parameter count, etc), but analytics applies the limits **during cloud processing**, the errors will not be seen as Promise rejections" — i.e. the SDK does not enforce param limits locally.
- `index.js:95-105`: the SDK validates only the **event name** (non-reserved, 1–40 alphanumeric/underscore). Params are passed through unvalidated.
- **GA4 documented limits** (Firebase Analytics docs — "Analytics limits"): ≤ **25 params per event**, param **name ≤ 40 chars**, param **value ≤ 100 chars**. `app_version` = 11 chars (lowercase letters + underscore — allowed charset); value is a semver version name (e.g. `1.4.2` = 5 chars; longest in tests `1.0.119` = 7 chars) — **trivially satisfied**.
- **Reserved-name check**: GA4 reserved event param names are the `firebase_*` / `google_*` / `ga_*` prefixes plus an explicit list (`session_id`, `engagement_time_msec`, `page_location`, etc.). **`app_version` is not reserved.** (It is the name of a _predefined user property_ "App version" — a different dimension that does not collide with event params; the same argument already applies to `platform`, in production today.)

**Result**: PASS, no discrepancy. `app_version` fits name/value limits and is not reserved.

### 3.4 Crashlytics `setAttribute` limits (attribute route kept)

**Verified (installed package, `apps/mobile/node_modules/@react-native-firebase/crashlytics/lib/index.d.ts` + `index.js`):**

- `index.d.ts:219`: `setAttribute(name: string, value: string): Promise<null>`.
- `index.js:85-98`: the SDK enforces only that name and value are strings.
- **Firebase docs limits** (Crashlytics custom keys): key **≤ 64 chars**, value **≤ 1024 chars**, max 64 custom keys per app. `app_version` (11 chars) and semver values — **trivially satisfied**; the key count stays at 2 (`custom_description` + `app_version`).

**Result**: PASS, no discrepancy.

**Verification summary — all four items PASS; no material discrepancies found.** The only nuance (Expo Go reports Expo Go's binary version via `nativeApplicationVersion`) is the known, accepted dev-only behavior documented in the proposal (§6) and confirmed by the package semantics.

---

## 4. Design Decision 3 — Logger Wrapper (`apps/mobile/src/utils/logger.ts`)

Replaces the pure re-export with a mobile-only enrichment wrapper. This is the single mobile indirection point for console logging (verified: 20+ mobile consumers import `@/utils/logger`; zero import `@sonora/shared` directly), and the API cannot reach it.

### 4.1 Exact implementation

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

### 4.2 Shape and edge cases

Enrichment is a **trailing metadata object**, never a text prefix (message text untouched, machine-parseable, consistent with the existing metadata-arg convention in `logger.test.ts`):

| Call                                                 | Console output (dev, mocked version `test-version`)                                      |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `logger.info('msg')`                                 | `[INFO] msg { app_version: 'test-version' }`                                             |
| `logger.info('request failed', { status: 500 })`     | `[INFO] request failed { status: 500 } { app_version: 'test-version' }`                  |
| `logger.info()` (no args)                            | `[INFO] { app_version: 'test-version' }` (deliberate, documented behavior change — FR-4) |
| `logger.info(undefined)`                             | `[INFO] undefined { app_version: 'test-version' }`                                       |
| `logger.info('event', 'user-login', { userId: 42 })` | `[INFO] event user-login { userId: 42 } { app_version: 'test-version' }`                 |

**Single-object-arg case** (`logger.info({ a: 1 })`): the object is spread as-is and the metadata object is appended after it — `[INFO] { a: 1 } { app_version: … }`. No special-casing; the spread-based `enrich` handles every arity uniformly.

### 4.3 Performance and suppression (NFR-5)

- `getAppVersion()` is a **synchronous getter** (a property read + `|| '0.0.0'` fallback — no I/O, no async). It is evaluated once per log call inside `enrich(args)`, which runs even for levels the shared logger then suppresses in production (`debug`/`info`). That cost is a single property read — negligible; NFR-5 explicitly states no lazy evaluation is required.
- **Suppression behavior is preserved** because the decision still lives inside the shared logger's `log()`; the wrapper only transforms the argument list. In production only `warn`/`error` reach the console, and those lines carry the version — exactly the lines that matter. (Regression coverage: the retained suppression tests, §9.3.)

### 4.4 Interface preservation (FR-4)

Exported shape stays `{ debug, info, warn, error }`, each `(...args: unknown[]) => void` — identical to the shared logger's shape. No consumer changes; no interface changes.

---

## 5. Design Decision 4 — `recordError` Design (FR-2, FR-3)

### 5.1 Native (`apps/mobile/src/services/analytics.ts`)

Exact change inside the existing `if (isFirebaseAvailable() && firebaseCrashlytics)` branch (`:103-108` today):

```ts
if (isFirebaseAvailable() && firebaseCrashlytics) {
  firebaseCrashlytics().setAttribute('app_version', getAppVersion().versionName);
  if (customDescription) {
    firebaseCrashlytics().setAttribute('custom_description', customDescription);
  }
  firebaseCrashlytics().recordError(error);
}
```

- `app_version` is set **unconditionally** (before the `custom_description` guard) so the attribute is present on the session for every recorded error, with or without a description.
- `setAttribute` is **session-scoped** (persists for the Crashlytics session) — same session as the error, per FR-2.
- **Fire-and-forget pattern kept**: `setAttribute` returns `Promise<null>`; the existing `custom_description` call is not awaited, and the surrounding try/catch covers synchronous throws only. `app_version` follows the exact established pattern — no new error handling introduced.
- The native console-fallback path (`logger.error('[Native Error - Disabled]', error, customDescription)` at `:109`) carries the version automatically via the wrapper (FR-2 scenario 2).

### 5.2 Web (`apps/mobile/src/services/analytics.web.ts`)

**No change to `recordError`** (`:105-111`). The existing call `logger.error('[Web Error]', error, customDescription)` flows through the wrapper, so the console line becomes:

```
[ERROR] [Web Error] <error> <description> { app_version: '1.4.2' }
```

The version appears **exactly once** — no explicit duplicate argument (FR-3's "exactly once" requirement). The wrapper-adoption default (proposal §5.4) is confirmed: no harm found that justifies the explicit-arg fallback.

---

## 6. Design Decision 5 — `trackEvent` Enrichment (FR-1)

### 6.1 Native (`apps/mobile/src/services/analytics.ts`)

- Add import: `import { getAppVersion } from '@/utils/app-version';` (with the existing imports at `:1-2`).
- Extend `extendedParams` (`:85-87`):

```ts
const extendedParams = {
  ...params,
  platform: Platform.OS,
  app_version: getAppVersion().versionName,
};
```

### 6.2 Web (`apps/mobile/src/services/analytics.web.ts`)

- Add import: `import { getAppVersion } from '@/utils/app-version';` (with the imports at `:1-5`).
- Extend `extendedParams` (`:89-91`) identically.

Both dispatch paths then carry `app_version`: the Firebase `logEvent` payload (`:92` / `:96`) and the console-fallback lines (`:94` / `:101`), which log `extendedParams` directly. One edit per platform covers all 20+ event registrations and both fallback paths — no call-site or event-map changes (FR-1, NFR-3).

---

## 7. Design Decision 6 — Double `app_version` on `AnalyticsService` Fallback Lines: **ACCEPT, do not dedupe**

The console-fallback lines in `trackEvent`/`recordError` log `extendedParams` (which now contains `app_version`), and the wrapper appends a second `{ app_version }` object — so the dev console line carries the version twice, e.g.:

```
[INFO] [Analytics Native - Disabled] Event: app_open { platform: 'ios', app_version: '1.4.2' } { app_version: '1.4.2' }
```

**Decision: accept the duplication; do not special-case or dedupe.** Rationale:

1. **No dedicated test asserts the fallback line shape** (FR-6 requires none; the fallback lines are covered structurally because they log `extendedParams`, whose exact shape is asserted in `:64`/`:79-81`). Dedupe would require either special-casing the wrapper (coupling it to `AnalyticsService` call shapes — bad) or dropping the wrapper arg on specific calls (fragile, call-site knowledge).
2. The fallback line stays **structurally identical to the Firebase payload** — `extendedParams` is literally the payload object; the appended wrapper object is separate metadata.
3. The duplication is **console-only and dev-mostly** (the shared logger suppresses `info` in production), harmless, and parseable.
4. Proposal §5.4 and the spec assumptions table both accept it; the optional future dedupe is already tracked as a future consideration in the proposal (§9).

---

## 8. Data Flow

```
trackEvent(event, params)
  └─ extendedParams = { ...params, platform: Platform.OS, app_version: getAppVersion().versionName }
       ├─ Firebase logEvent (native :92 / web :96)      → payload carries app_version
       └─ console fallback logger.info(…, extendedParams) → dev console line (version twice — accepted, §7)

recordError(error, description)
  ├─ native: setAttribute('app_version', …) + setAttribute('custom_description', …)? + recordError(error)
  │          → Crashlytics session attribute (FR-2)
  └─ web: logger.error('[Web Error]', error, description)
       └─ wrapper appends { app_version }               → console error line, version exactly once (FR-3)

any logger.debug/info/warn/error(...) in apps/mobile
  └─ wrapper appends { app_version }                    → every mobile console line carries the version (FR-4)
```

---

## 9. Test Design (FR-6, strict TDD)

### 9.1 Mock strategy

Both test files add the same module mock (deterministic regardless of jest's module resolution — under jest, `@/utils/app-version` resolves to the expo-constants `.ts` variant unless mocked):

```ts
jest.mock('@/utils/app-version', () => ({
  getAppVersion: () => ({ versionName: 'test-version', formatted: 'test-version' }),
}));
```

Hoisted by jest, so it applies to the wrapper's import chain (`logger.ts → @/utils/app-version`) in both `analytics.test.ts` (native + `jest.requireActual('../analytics.web')`) and `logger.test.ts`. No other mocks change; the existing firebase mocks, `NativeModules.RNFBAppModule = {}` stub, and `__DEV__` toggling are untouched.

### 9.2 `apps/mobile/src/services/__tests__/analytics.test.ts` — exact changes

| Location                                                  | Current                                                                                    | New                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| module scope (with the other `jest.mock` calls, `:21-41`) | —                                                                                          | add `jest.mock('@/utils/app-version', …)`                                                                               |
| `:64` native exact-param assertion                        | `expect(mockLogEvent).toHaveBeenCalledWith('test_event', { foo: 'bar', platform: 'ios' })` | `expect(mockLogEvent).toHaveBeenCalledWith('test_event', { foo: 'bar', platform: 'ios', app_version: 'test-version' })` |
| `:70-72` native `recordError` test                        | asserts `custom_description` + `recordError(error)`                                        | add `expect(mockSetAttribute).toHaveBeenCalledWith('app_version', 'test-version');` (keeps both existing assertions)    |
| `:79-81` web exact-param assertion                        | `{ foo: 'web_bar', platform: 'web' }`                                                      | `{ foo: 'web_bar', platform: 'web', app_version: 'test-version' }`                                                      |
| `:88-92` web console-error assertion                      | `('[ERROR]', '[Web Error]', error, 'Web custom description')`                              | `('[ERROR]', '[Web Error]', error, 'Web custom description', { app_version: 'test-version' })`                          |

**No new analytics test blocks are added** — FR-6 requires exactly these updates; the native/web console-fallback lines are covered structurally (they log the same `extendedParams` object whose shape is asserted at `:64` / `:79-81`). Inventing fallback-line tests would lock in the accepted double-`app_version` console shape (§7) and expand scope beyond the spec.

### 9.3 `apps/mobile/src/utils/__tests__/logger.test.ts` — exact changes

Add the `jest.mock('@/utils/app-version', …)` above; update every exact console-arg assertion to append `{ app_version: 'test-version' }`:

| Test                                   | Current                                             | New                                                                                  |
| -------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `logger.debug` (`:23-25`)              | `('[DEBUG]', 'test message')`                       | `('[DEBUG]', 'test message', { app_version: 'test-version' })`                       |
| `logger.info` (`:29-31`)               | `('[INFO]', 'info message')`                        | `('[INFO]', 'info message', { app_version: 'test-version' })`                        |
| `logger.warn` (`:35-37`)               | `('[WARN]', 'warn message')`                        | `('[WARN]', 'warn message', { app_version: 'test-version' })`                        |
| `logger.error` (`:41-43`)              | `('[ERROR]', 'error message')`                      | `('[ERROR]', 'error message', { app_version: 'test-version' })`                      |
| metadata passthrough (`:49-52`)        | `('[INFO]', 'request failed', meta)`                | `('[INFO]', 'request failed', meta, { app_version: 'test-version' })`                |
| multiple args (`:56-58`)               | `('[INFO]', 'event', 'user-login', { userId: 42 })` | `('[INFO]', 'event', 'user-login', { userId: 42 }, { app_version: 'test-version' })` |
| `shows warn in production` (`:72-74`)  | `('[WARN]', 'warning in prod')`                     | `('[WARN]', 'warning in prod', { app_version: 'test-version' })`                     |
| `shows error in production` (`:78-80`) | `('[ERROR]', 'error in prod')`                      | `('[ERROR]', 'error in prod', { app_version: 'test-version' })`                      |
| no-args (`:87-89`)                     | `('[INFO]')`                                        | `('[INFO]', { app_version: 'test-version' })`                                        |
| undefined/null (`:93-95`)              | `('[INFO]', undefined)`                             | `('[INFO]', undefined, { app_version: 'test-version' })`                             |

**New test — "appends app_version metadata to every level"** (FR-6 focused enrichment test):

```ts
it('appends app_version metadata to every level', () => {
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  logger.debug('d');
  logger.info('i');
  logger.warn('w');
  logger.error('e');
  expect(logSpy).toHaveBeenCalledWith('[DEBUG]', 'd', { app_version: 'test-version' });
  expect(logSpy).toHaveBeenCalledWith('[INFO]', 'i', { app_version: 'test-version' });
  expect(warnSpy).toHaveBeenCalledWith('[WARN]', 'w', { app_version: 'test-version' });
  expect(errorSpy).toHaveBeenCalledWith('[ERROR]', 'e', { app_version: 'test-version' });
});
```

**Production-suppression regression coverage**: the four existing suppression tests (`suppresses debug in production`, `suppresses info in production`, `shows warn in production`, `shows error in production`, `:63-80`) assert exactly what FR-6 requires — `debug`/`info` suppressed when `__DEV__` is false, `warn`/`error` always emit. They are **retained and updated** (the two `shows *` assertions gain the trailing object) and constitute the required regression coverage; **no redundant consolidated suppression test is added** (it would duplicate four existing tests).

### 9.4 What is intentionally NOT tested

- Native console-fallback and web console-fallback `trackEvent` lines (new console-shape assertions): not required by FR-6; fallback lines are structurally covered via `extendedParams` exact assertions; avoids locking in the accepted double-`app_version` shape.
- The `'0.0.0'` fallback through the enriched paths: the helpers' own fallback behavior is already tested in `app-version.test.ts` / `app-version.native.test.ts`; FR-5 requires no new fallback test.
- `app-version` helpers, `app.config.ts`, event map types, call sites: NFR-3 — untouched, no tests needed.

---

## 10. Strict TDD Implementation Order (for apply)

Strict TDD is active. Two independent red→green cycles, tests first, then `make validate`.

```
Cycle 1 — logger wrapper (self-contained; unblocks Cycle 2's web console-error assertion):
  Step 1  RED   Update apps/mobile/src/utils/__tests__/logger.test.ts
                (mock app-version; update all assertions per §9.3; add "every level" test)
                Run: cd apps/mobile && bun run jest src/utils/__tests__/logger.test.ts --watchAll=false
                → fails (wrapper still a pure re-export, no trailing object)
  Step 2  GREEN Implement apps/mobile/src/utils/logger.ts wrapper (§4.1)
                Run the same command → passes

Cycle 2 — AnalyticsService enrichment:
  Step 3  RED   Update apps/mobile/src/services/__tests__/analytics.test.ts (§9.2)
                Run: cd apps/mobile && bun run jest src/services/__tests__/analytics.test.ts --watchAll=false
                → fails (services don't inject app_version; web console line lacks trailing object)
  Step 4  GREEN Implement analytics.ts (§5.1, §6.1) and analytics.web.ts (§6.2)
                Run the same command → passes

Gate:
  Step 5  Full validation: make validate
                (format lint typecheck api-typecheck scripts-typecheck doctor-ci test gga —
                 includes the API suite, proving backend isolation NFR-1)
```

**Backend-isolation check**: `git diff --stat -- packages/shared apps/api` must be empty after Step 5.

---

## 11. Edge Cases

| Edge case                                                     | Behavior                                                               | Design disposition                                                                                                                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Expo Go dev (native)**                                      | `getAppVersion()` reports Expo Go's binary version                     | Accepted (dev-only noise, filterable by `platform`/`app_version`); consistent with what the splash screen shows in dev; production builds accurate (Decision 1) |
| **Missing version**                                           | Helper returns `'0.0.0'` (existing convention)                         | Unreachable in real builds (`app.config.ts:30-36` throws without `APP_VERSION_NAME`); no new fallback invented (FR-5)                                           |
| **Double `app_version` on `AnalyticsService` fallback lines** | `extendedParams` carries it + wrapper appends it again                 | **Accepted, no dedupe** (Decision 6)                                                                                                                            |
| **Web `recordError` version duplication**                     | Wrapper appends exactly one object; no explicit arg in the call        | Exactly once per FR-3                                                                                                                                           |
| **No-args logger calls**                                      | `[INFO] { app_version: … }`                                            | Deliberate documented behavior change (FR-4), covered by updated test                                                                                           |
| **`undefined` args**                                          | `[INFO] undefined { app_version: … }`                                  | Covered by updated test                                                                                                                                         |
| **Production suppression**                                    | `debug`/`info` suppressed; `warn`/`error` emit with version            | Preserved by design (§4.3), regression-tested (§9.3)                                                                                                            |
| **Backend logs**                                              | Byte-identical (wrapper unreachable from API; shared logger untouched) | NFR-1; API logger-spy tests guard regressions                                                                                                                   |
| **`setAttribute` promise rejection**                          | Unhandled (same as existing `custom_description` pattern)              | Accepted — no new error-handling pattern introduced (Decision 4)                                                                                                |

---

## 12. Risks & Mitigations

| Risk                                                 | Likelihood                     | Impact | Mitigation                                                                                                                                                |
| ---------------------------------------------------- | ------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expo Go dev reports Expo Go's version                | Certain (dev-only)             | Low    | Decision 1; production accurate; filterable by `platform`                                                                                                 |
| `'0.0.0'` fallback in edge cases/tests               | Low                            | Low    | Existing convention; unreachable in real builds                                                                                                           |
| Console noise (trailing object on every mobile line) | Certain (dev) / limited (prod) | Medium | Accepted per user decision; prod shows only `warn`/`error`; single parseable object                                                                       |
| Backend pollution (accidental shared-logger change)  | Low                            | Medium | Enrichment confined to `apps/mobile`; `packages/shared` byte-identical (Step 5 gate); API suite guards                                                    |
| Web/native drift                                     | Low                            | Low    | Both service files in same PR; same helper import; exact assertions on both platforms                                                                     |
| Existing exact-assertion tests break                 | Certain (deliberate)           | Low    | Updated in the same change per strict TDD; assertions are the spec (FR-6)                                                                                 |
| Firebase/Crashlytics param limits or reserved names  | Low                            | Low    | Verified against installed SDK 56 artifacts (§3); `app_version` 11 chars, non-reserved, values ≪ limits                                                   |
| Doc-site drift vs installed packages                 | Low                            | Low    | Verification grounded in installed package artifacts (§3 method note); values far below limits; apply re-checks the online docs if a browser is available |

---

## 13. Acceptance Criteria Mapping (spec AC 1–10)

| AC                                                                                    | Design coverage                                             |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1. Native `trackEvent` payloads carry `app_version`                                   | §6.1, §9.2 (`:64` update)                                   |
| 2. Web `trackEvent` payloads carry `app_version`                                      | §6.2, §9.2 (`:79-81` update)                                |
| 3. Native `recordError` sets the Crashlytics attribute                                | §5.1, §9.2 (new `setAttribute('app_version', …)` assertion) |
| 4. Web `recordError` console output includes the version, exactly once                | §5.2 (wrapper), §9.2 (`:88-92` update)                      |
| 5. Every mobile `logger.*` line carries the version                                   | §4, §9.3                                                    |
| 6. Version value semantics (name only, single source of truth, `'0.0.0'` unchanged)   | §2 (Decision 1), §11                                        |
| 7. Backend isolation (`packages/shared` + `apps/api` byte-identical; API suite green) | §1.1, §10 Step 5, §12                                       |
| 8. No scope creep (no deps; call sites/map/config/helpers untouched)                  | §1.1, NFR-2/NFR-3                                           |
| 9. `make validate` passes                                                             | §10 Step 5                                                  |
| 10. Expo v56 doc verification passes before code                                      | §3 (all four items PASS)                                    |

---

## 14. Design Decision 7 — `X-App-Version` Header on All Frontend API Requests (FR-7, user-approved scope extension)

Every HTTP request leaving the mobile frontend carries the app version header. The mobile HTTP boundary is `apps/mobile/src/services/api-client.ts` — the only file that touches `BaseApiClient` from `@sonora/shared`.

### 14.1 Exact implementation

**`MobileApiClient.getAuthHeader()`** (currently returns `{ 'X-Device-Id': …, 'X-Device-Platform': … }`): add `'X-App-Version': getAppVersion().versionName`. This header flows into EVERY `ApiClient.get/post/put/patch/delete` request because `BaseApiClient.request()` merges `getAuthHeader()` into the outgoing headers (`packages/shared/src/api/base-client.ts` `request()` — untouched).

**`ApiClient.fetchWithDeviceId()`** (raw-fetch path used by audio cache-busting): add `headers.set('X-App-Version', getAppVersion().versionName)` alongside the existing `X-Device-Id`/`X-Device-Platform` sets.

### 14.2 Edge cases

- **Missing device id**: `getAuthHeader()` already throws before reaching the header object (pre-existing behavior) — `X-App-Version` is added to the returned object after `getDeviceId()` succeeds, so no change to the throw path.
- **`getAppVersion()` synchronous**: header value is a synchronous property read; no async/IO added to the request path.
- **Backend**: the API already logs all request headers (`apps/api/src/middleware/logger.ts`) — `X-App-Version` becomes visible in API request logs with zero backend changes (an accepted, beneficial side effect; NFR-1 still holds because `apps/api` is untouched).

### 14.3 Test design (FR-7, strict TDD)

`apps/mobile/src/services/__tests__/api-client.test.ts` already tests `X-Device-Id`/`X-Device-Platform` injection (existing pattern `:131-156`). Add:

- Mock `@/utils/app-version` (return `{ versionName: 'test-version' }`).
- Extend the existing header-injection tests with `X-App-Version` in `objectContaining`.
- Add a `fetchWithDeviceId` test asserting the header is set.
- Keep the shared `base-client.ts` untouched (NFR-1 re-verified via empty `git diff` on `packages/shared`).

---

## Appendix A: Out of Scope / Explicitly Not Touched

- `packages/shared/src/utils/logger.ts` and all `apps/api` files (NFR-1)
- The 20+ `trackEvent`/`recordError` call sites and `AnalyticsEventMap` types (NFR-3)
- `app.config.ts` (NFR-3), `apps/mobile/src/utils/app-version.ts`, `apps/mobile/src/utils/app-version.native.ts` (NFR-3)
- New dependencies (NFR-2)
- Minimum-version enforcement (archived `2026-07-02-app-version-check` scope), splash/UI version display changes (archived `2026-07-26-splash-version` scope)
- Version in API request headers (future observability change, proposal §9)
