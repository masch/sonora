# Proposal: Show App Version on Splash Screen

## Identifiers

| Field          | Value                      |
| -------------- | -------------------------- |
| Change name    | `splash-version`           |
| Status         | implemented                |
| Artifact store | hybrid (engram + openspec) |

## Intent

Show the app version (`1.1.0 (13)`) on the animated splash screen of Sonora, bottom center, both in staging and production.

## Problem Statement

Currently:

1. `app.config.ts` hardcodes `version: '1.0.0'` — never updated in CI.
2. No runtime version visibility — users/testers can't tell what version they're running from the UI.
3. `versionCode` is already injected from CI (`APP_VERSION_CODE`) but version name is not.

CI already generates tags `prod-v1.0.X` / `stg-v1.0.X` and injects `APP_VERSION_CODE`. The semver from the tag needs to be extracted, passed as `APP_VERSION_NAME`, and displayed on the splash.

## Scope

### In scope (MVP)

1. **CI/CD — both workflows**: extract semver from tag and validate it before the build step. If extraction fails, the job stops with error.
2. **`app.config.ts`**: read `APP_VERSION_NAME` from env var, throw if missing (no fallback).
3. **`AnimatedSplashOverlay`**: read `expo-application.nativeApplicationVersion` + `nativeBuildVersion`, render text bottom center, dynamic color per env, duration 2000ms.
4. **Null-safe runtime**: if version or build is null, no text rendered (no crash).
5. **ci-bundle-size.yml**: set `APP_VERSION_NAME: '0.0.0'` placeholder since it runs `expo export` which reads app.config.ts.

### Excluded

- Settings screen version display, i18n, iOS CI, web splash, automated tests (added post-hoc)

## Affected Files

| File                                                        | Change                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| `.github/workflows/deploy-mobile-android-production.yml`    | Extract + validate semver from tag, pass `APP_VERSION_NAME` |
| `.github/workflows/deploy-mobile-android-staging.yml`       | Same                                                        |
| `.github/workflows/ci-bundle-size.yml`                      | Add `APP_VERSION_NAME: '0.0.0'` env var                     |
| `apps/mobile/app.config.ts`                                 | Read `APP_VERSION_NAME`, throw if missing                   |
| `apps/mobile/src/components/animated-icon.tsx`              | Version text, dynamic color, 2000ms                         |
| `apps/mobile/src/constants/theme.ts`                        | Centralized `SPLASH_COLORS`                                 |
| `apps/mobile/src/__tests__/animated-splash-screen.test.tsx` | 3 unit tests                                                |
| `Makefile`                                                  | `doctor-ci` uses `--scope changed --blocking warning`       |
| `.githooks/pre-commit`                                      | Fail-fast on first validation error                         |

## Design Decisions

1. **CI guard (primary)**: explicit step extracting semver from tag, validates non-empty + format `X.Y.Z`.
2. **app.config.ts guard (secondary)**: throw if `APP_VERSION_NAME` not defined. Covers local builds without CI.
3. **Runtime**: component reads `expo-application.nativeApplicationVersion` to display version. Null → no render.
4. **Environment detection**: via `Constants.expoConfig?.extra?.isProduction`.
5. **Colors**: prod `#208AEF`, staging `#F59E0B`.
6. **Format**: `${appVersion} (${buildNumber})` — e.g. `1.0.3 (42)`.
7. **Duration**: 2000ms.

## Success Criteria

1. CI job fails if semver cannot be extracted from tag (empty or invalid format)
2. app.config.ts fails if `APP_VERSION_NAME` is not defined
3. CI workflows extract semver from tag and pass as env var
4. Splash shows `1.0.3 (42)` at bottom center
5. Color staging (amber) vs prod (blue) correct
6. Null-safe: no text if runtime version unavailable
7. Duration ~2000ms
8. react-doctor passes with 0 warnings in diff scan
