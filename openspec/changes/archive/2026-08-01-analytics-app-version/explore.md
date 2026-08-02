# Exploration: Analytics App Version Enrichment

## Summary

Requirement: **any activity log registered from the frontend must also include the app version**. Current state analysis of the mobile frontend (`apps/mobile`) activity/analytics pipeline. All activity logs (analytics events, error records) already funnel through two central `AnalyticsService` objects (`trackEvent` / `recordError`), which already inject `platform: Platform.OS` into every event — the enrichment point to extend with `app_version`. A production-ready, tested, cross-platform version reader already exists (`getAppVersion()` with `.native.ts` / `.ts` platform split). The shared `@sonora/shared` logger is also consumed by the API, so version enrichment MUST happen at the mobile boundary, never inside `packages/shared`.

---

## 1. Activity Log Registration Points (Frontend)

Every frontend activity log flows through `AnalyticsService.trackEvent` or `AnalyticsService.recordError`. No call site bypasses the service.

### trackEvent call sites

| Call site        | Event(s)                                                                                                                                              | File:line                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Root layout      | `app_open`                                                                                                                                            | `apps/mobile/src/app/_layout.tsx:82`                                            |
| Purchase flow    | `payment_checkout_started`, `payment_completed`, `payment_failed` (×2)                                                                                | `apps/mobile/src/hooks/use-purchase.ts:206, 225, 263, 287`                      |
| Geofence trigger | `geofence_entered`, `geofence_exited`                                                                                                                 | `apps/mobile/src/hooks/use-feedback-trigger.ts:50, 55`                          |
| Network monitor  | `network_status_changed`                                                                                                                              | `apps/mobile/src/hooks/use-network-status.ts:39`                                |
| Download manager | `audio_download_started`, `audio_download_completed`, `audio_download_failed`                                                                         | `apps/mobile/src/store/download-manager-store.ts:224, 372, 399`                 |
| Location store   | `gps_permission_status`, `gps_status_changed`                                                                                                         | `apps/mobile/src/store/location-store.ts:31, 61`                                |
| Audio player     | `audio_playback_started` (×2), `audio_playback_paused`, `audio_playback_stopped`, `audio_seeked`, `audio_playback_completed`, `audio_playback_failed` | `apps/mobile/src/store/audio-player-store.ts:126, 142, 156, 167, 198, 234, 242` |

### recordError call sites

| Call site                            | File:line                                             |
| ------------------------------------ | ----------------------------------------------------- |
| Download failure                     | `apps/mobile/src/store/download-manager-store.ts:404` |
| Playback failure                     | `apps/mobile/src/store/audio-player-store.ts:247`     |
| Root `ErrorBoundary`                 | `apps/mobile/src/app/_layout.tsx:134`                 |
| Unhandled promise rejection (native) | `apps/mobile/src/services/analytics.ts:122`           |
| Unhandled promise rejection (web)    | `apps/mobile/src/services/analytics.web.ts:114`       |

---

## 2. The Central Enrichment Point (Current State)

Both platform implementations already inject `platform: Platform.OS` into every event — the exact pattern to extend:

**Native** — `apps/mobile/src/services/analytics.ts`:

- `trackEvent` (`:84-99`): builds `extendedParams = { ...params, platform: Platform.OS }`; dispatches to Firebase `logEvent` when `NativeModules.RNFBAppModule` exists, else falls back to `logger.info('[Analytics Native - Disabled] Event: …', extendedParams)`.
- `recordError` (`:101-113`): Crashlytics `setAttribute('custom_description', …)` + `recordError(error)`; fallback `logger.error('[Native Error - Disabled]', …)`.
- Firebase modules are loaded via **dynamic require** inside try/catch (available only in dev/prod builds, not Expo Go).

**Web** — `apps/mobile/src/services/analytics.web.ts`:

- `trackEvent` (`:86-104`): same `extendedParams` pattern; Firebase Web SDK `logEvent` or console fallback.
- `recordError` (`:105-111`): console-only `logger.error('[Web Error]', …)`.

Adding `app_version` to `extendedParams` in both `trackEvent` implementations covers **all 20+ event registrations** and both console-fallback paths (which log `extendedParams` directly). `recordError` needs its own treatment (Crashlytics attributes vs. web console args).

**Param naming**: existing event params use snake_case (`track_id`, `error_msg`, `position_ms`) → use `app_version`.

---

## 3. Version Sources at Runtime — `getAppVersion()` Already Exists

A dedicated, tested helper with a platform split already exists (created by the archived `2026-07-26-splash-version` change):

- **`apps/mobile/src/utils/app-version.ts`** (web; also the jest-resolved default): reads `Constants.expoConfig?.extra?.appVersionName ?? '0.0.0'` — `extra.appVersionName` is injected into `ExpoConfig` by `app.config.ts:174-178` from the `APP_VERSION_NAME` env var (guard at `app.config.ts:30-36`, throws at build time without it; also sets `version` at `:47`).
- **`apps/mobile/src/utils/app-version.native.ts`** (iOS/Android via Metro `[platform]` resolution): reads `Application.nativeApplicationVersion || '0.0.0'` from `expo-application`.
- Both return `{ versionName, formatted }` (currently identical values).
- Consumers today: `components/animated-icon.tsx:17` (splash), `components/animated-icon.web.tsx:13`, `components/app-version-text.tsx:11` (web home screen).

### API verification (installed package types, SDK 56)

- `expo-application@56.0.3` (`apps/mobile/package.json:16`): `Application.d.ts:10` → `nativeApplicationVersion: string | null`; source comment (`Application.ts:12-20`): on Android it is the `version` from app config (versionName), on iOS `CFBundleShortVersionString`; **`null` on web** (`ExpoApplication.web.ts:8-10`). No async needed — synchronous getter.
- `expo-constants@56.0.21` (`apps/mobile/package.json:21`): `Constants.expoConfig` (with `version` + `extra`) works on native and web. Already used in production: `store/remote-config-store.ts:154` (`Constants.expoConfig?.version ?? ''`) and `utils/app-version.ts`.
- No new npm dependencies required.

### Dev (Expo Go) vs production behavior — decision to make in design

- **Production builds**: `Application.nativeApplicationVersion` === the `APP_VERSION_NAME` baked at build time (`version` field) → accurate.
- **Expo Go dev**: `nativeApplicationVersion` returns **Expo Go's own binary version** (the app's version is not baked into the Expo Go binary). Meanwhile `extra.appVersionName` comes from the loaded app manifest/config and reflects the developer's `APP_VERSION_NAME` → more correct in Expo Go.
- **Web**: `nativeApplicationVersion` is `null`; only `extra.appVersionName` / `Constants.expoConfig.version` works (which is why the `.ts` variant exists).
- **Recommendation for design**: reuse `getAppVersion().versionName` as-is for consistency with the rest of the app (splash + home screen show the same value). The Expo Go nuance only affects dev traffic (Firebase events from Expo Go builds are dev noise and can be filtered by `platform`/`app_version`), and `'0.0.0'` fallback covers missing version. Alternative: prefer `extra.appVersionName` everywhere for cross-platform consistency — flag this as an explicit design-time decision.

---

## 4. Shared Logger Boundary (Critical Constraint)

- `packages/shared/src/utils/logger.ts` — plain console logger (`[DEBUG]/[INFO]/[WARN]/[ERROR]` prefixes, `__DEV__`-aware suppression).
- `apps/mobile/src/utils/logger.ts` is a **pure re-export** (`export { logger } from '@sonora/shared'`).
- **The shared logger is ALSO used by the API**:
  - `apps/api/src/lib/http-client.ts:1` (`logger.info('[HTTP Request] …')`)
  - `apps/api/src/payments/mercadopago.ts:1` (incl. `[METRIC:invalid_signature_total]` warns)
  - `apps/api/src/scripts/migrations/migrate-cli.ts:9`
  - API tests spy on it: `apps/api/src/__tests__/payments.test.ts:400-401`
- **Conclusion**: version enrichment MUST NOT be added inside `packages/shared/src/utils/logger.ts` — it would pollute backend logs with a frontend version. If console logs must carry the version, the mobile boundary is `apps/mobile/src/utils/logger.ts`, but that adds noise to every mobile console message. **Recommendation: do not touch the generic logger**; the analytics service already logs `extendedParams` (which will include `app_version`) in its console-fallback paths, covering the "activity log" semantics. The mobile logger re-export file is a re-export only; leave as-is.

---

## 5. Test Conventions

Runner: **Jest + `jest-expo`** preset (`apps/mobile/package.json:94-117`), `setupFiles: ./jest.setup.ts`, `moduleNameMapper ^@/(.*)$ → <rootDir>/src/$1`. Co-located tests in `src/__tests__/` and `src/services/__tests__/`.

Existing patterns relevant to this change:

| Pattern                                                                  | Example                                                                                                                                                                                |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Firebase module mocks (native + web)                                     | `apps/mobile/src/services/__tests__/analytics.test.ts:20-53` — mocks `@react-native-firebase/analytics`, `crashlytics`, `firebase/analytics`; stubs `NativeModules.RNFBAppModule = {}` |
| **Exact param assertions** (will break)                                  | `analytics.test.ts:64` `expect(mockLogEvent).toHaveBeenCalledWith('test_event', { foo: 'bar', platform: 'ios' })` and `:81` web variant — adding `app_version` requires updating these |
| expo-application mock (getter + mutable state)                           | `apps/mobile/src/__tests__/app-version.native.test.ts:9-15`                                                                                                                            |
| expo-constants mock                                                      | `apps/mobile/src/__tests__/app-version.test.ts:9-13`, `apps/mobile/src/store/__tests__/remote-config-store.test.ts:8-11`                                                               |
| Utility module mock (cleanest for analytics tests)                       | `apps/mobile/src/services/__tests__/device-service.web.test.ts:11` — `jest.mock('@/utils/logger', …)`; recommend `jest.mock('@/utils/app-version', …)` in `analytics.test.ts`          |
| Global setup mocks                                                       | `apps/mobile/jest.setup.ts` — mocks firebase packages, expo-sqlite, netinfo, router, audio, crypto. Does **not** mock `expo-application`/`expo-constants` (tests do it locally)        |
| Store/hook tests mock `AnalyticsService` / `@/utils/logger` individually | `apps/mobile/src/store/__tests__/remote-config-store.test.ts`, `apps/mobile/src/__tests__/use-purchase.test.ts:45`                                                                     |

Note: under jest, `@/utils/app-version` resolves to `src/utils/app-version.ts` (expo-constants path) unless a test mocks it; explicit `jest.mock('@/utils/app-version', () => ({ getAppVersion: () => ({ versionName: 'test-version', formatted: 'test-version' }) }))` keeps the assertion deterministic without depending on resolver behavior.

---

## 6. Prior Art (reuse, do not copy scope)

| Archived change                                | Reusable                                                                                                                                                                                                                 | Not to copy                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `2026-07-02-app-version-check`                 | Runtime version reading via `Constants.expoConfig.version` (`remote-config-store.ts:154`); `packages/shared/src/semver.ts` `gte()`; expo-constants mock pattern                                                          | Minimum-version enforcement, block/warn UI, grace period — different scope |
| `2026-07-26-splash-version`                    | **`getAppVersion()` helper (`.ts` + `.native.ts`), `APP_VERSION_NAME` env injection in `app.config.ts`, CI tag → version extraction, `'0.0.0'` fallback convention, `AppVersionText`/`AnimatedSplashOverlay` consumers** | Splash overlay rendering                                                   |
| `2026-07-29-sec-api-mobile-security-hardening` | This file's OpenSpec explore format                                                                                                                                                                                      | Everything else                                                            |

---

## 7. Expo v56 Docs — Must Verify Before Writing Code (AGENTS.md mandate)

`AGENTS.md:3` mandates reading the exact versioned docs (`https://docs.expo.dev/versions/v56.0.0/`) before writing any code. Items to verify in propose/design (no browser available during exploration):

1. `expo-application` v56 page — `nativeApplicationVersion` semantics, especially **Expo Go behavior** (returns Expo Go's version vs the app's) and null cases.
2. `expo-constants` v56 page — `expoConfig` availability on web and in Expo Go; confirm `extra` passthrough.
3. Firebase Analytics `logEvent` constraints (param count ≤ 25, param name ≤ 40 chars, value ≤ 100 chars) — `app_version` fits trivially; no reserved-name collision (`app_version` is not a reserved Firebase param; `platform` already in use today).
4. Crashlytics `setAttribute` key/value limits (key ≤ 64 chars, value ≤ 1024 chars) if the attribute route is chosen.

---

## 8. Recommended Approach

**Single enrichment point**: inject `app_version: getAppVersion().versionName` into `extendedParams` in `trackEvent` of **both** `apps/mobile/src/services/analytics.ts` and `apps/mobile/src/services/analytics.web.ts`, next to the existing `platform` injection. This covers every trackEvent call site and both console-fallback log paths.

**recordError**:

- Native: Crashlytics already attaches the real binary version to crash reports automatically, but for explicit/quariable data add `setAttribute('app_version', getAppVersion().versionName)` alongside the existing `setAttribute('custom_description', …)` pattern (`analytics.ts:106`). Note `setAttribute` is session-scoped (persists for the session).
- Web: include the version in the console error call args (`analytics.web.ts:107`).

**Do not touch**: `packages/shared/src/utils/logger.ts` (API consumer), `apps/mobile/src/utils/logger.ts` (pure re-export), the 20+ call sites, the event map types (or add `app_version` as a `Record`-wide computed field — design decides).

**Tests to update/add**:

- Update `apps/mobile/src/services/__tests__/analytics.test.ts` param assertions (`:64`, `:81`) to include `app_version`; mock `@/utils/app-version`.
- Optionally add explicit `setAttribute('app_version', …)` assertion in the native `recordError` test (`:70-73`).

**Files touched (estimate)**: 2 service files + 1 test file (+1 if recordError attribute asserted). ~15-25 lines total. Small, single-PR scope.

---

## 9. Risks

| Risk                                                                                     | Severity            | Mitigation                                                                                             |
| ---------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| Expo Go dev reports Expo Go's version via `nativeApplicationVersion`                     | LOW (dev-only data) | Accept + document; or design decision to prefer `extra.appVersionName`. Production builds are accurate |
| `'0.0.0'` fallback when version missing (web without `extra.appVersionName`, e.g. tests) | LOW                 | Existing convention; filterable in dashboards                                                          |
| Firebase reserved-param collision or length limits                                       | LOW                 | `app_version` is short and non-reserved; verify in v56 docs (see §7)                                   |
| Accidentally enriching shared logger → backend logs polluted with frontend version       | MEDIUM              | Enrich only in `AnalyticsService`; leave `packages/shared` logger untouched                            |
| Web/native drift (one platform updated, other missed)                                    | LOW                 | Both service files changed in the same PR; same helper import                                          |

## Key Findings Summary

- All 20+ frontend activity events and 5 error paths funnel through `AnalyticsService.trackEvent` / `recordError` (`analytics.ts` / `analytics.web.ts`) — one enrichment point per platform, mirroring the existing `platform: Platform.OS` injection.
- A tested, cross-platform `getAppVersion()` helper already exists (`utils/app-version.ts` web / `utils/app-version.native.ts` native) with `'0.0.0'` fallback; `expo-application@56.0.3` and `expo-constants@56.0.21` are installed and verified against package types.
- `@sonora/shared` logger is used by the API → enrichment must stay at the mobile `AnalyticsService` boundary, not in shared.
- Expo Go `nativeApplicationVersion` nuance is the one real behavioral fork to decide in design.
