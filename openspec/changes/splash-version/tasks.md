# Tasks: splash-version

## Review Workload Forecast

| Field                   | Value     |
| ----------------------- | --------- |
| Estimated changed lines | ~70       |
| 400-line budget risk    | Low       |
| Chained PRs recommended | No        |
| Suggested split         | single PR |

## Implementation Tasks

### Task 1: Extract & Validate Version Name — Production CI

**File:** `.github/workflows/deploy-mobile-android-production.yml`
**Estimated lines:** +15
**Risk:** Low
**Status:** ✅ Implemented

### Task 2: Extract & Validate Version Name — Staging CI

**File:** `.github/workflows/deploy-mobile-android-staging.yml`
**Estimated lines:** +15
**Risk:** Low
**Status:** ✅ Implemented

### Task 3: Guard APP_VERSION_NAME in app.config.ts

**File:** `apps/mobile/app.config.ts`
**Estimated lines:** +8 / -1
**Risk:** Low
**Status:** ✅ Implemented

### Task 4: Render version text in AnimatedSplashOverlay

**File:** `apps/mobile/src/components/animated-icon.tsx`
**Estimated lines:** +35 / -2
**Risk:** Low-Medium
**Status:** ✅ Implemented

## Extra Tasks (added during implementation)

### Task 5: Centralize splash colors in theme.ts

**File:** `apps/mobile/src/constants/theme.ts`
**Status:** ✅ Implemented

### Task 6: Add unit tests

**File:** `apps/mobile/src/__tests__/animated-splash-screen.test.tsx`
**Status:** ✅ 3 tests passing

### Task 7: Fix bundle-size CI workflow

**File:** `.github/workflows/ci-bundle-size.yml`
**Status:** ✅ `APP_VERSION_NAME: '0.0.0'` placeholder

### Task 8: Fix doctor-ci and pre-commit hook

**Files:** `Makefile`, `.githooks/pre-commit`
**Status:** ✅ fail-fast + `--scope changed --blocking warning`
