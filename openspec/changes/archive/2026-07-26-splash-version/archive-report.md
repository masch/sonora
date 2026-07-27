# SDD Archive Report: splash-version

## Identifiers

| Field          | Value                      |
| -------------- | -------------------------- |
| Change name    | `splash-version`           |
| Archive date   | 2026-07-26                 |
| Artifact store | hybrid (engram + openspec) |
| Archive status | **PASS**                   |

## Artifacts Read

| Artifact       | Topic Key / Path                                                                       |
| -------------- | -------------------------------------------------------------------------------------- |
| Proposal       | `sdd/splash-version/proposal` (obs 96) / `openspec/changes/splash-version/proposal.md` |
| Spec           | `sdd/splash-version/spec` (obs 97) / `openspec/changes/splash-version/specs/index.md`  |
| Design         | `sdd/splash-version/design` (obs 98) / `openspec/changes/splash-version/design.md`     |
| Tasks          | `sdd/splash-version/tasks` (obs 99) / `openspec/changes/splash-version/tasks.md`       |
| Apply Progress | `sdd/splash-version/apply-progress` (obs 100)                                          |
| Verify Report  | `sdd/splash-version/verify-report` (obs 101)                                           |

## Objective

Show the app version (`1.0.3 (42)`) on the animated splash screen of Sonora, injecting version name from CI (git tag semver), for both staging and production.

## Scope

**4 files modified:**

- `.github/workflows/deploy-mobile-android-production.yml`
- `.github/workflows/deploy-mobile-android-staging.yml`
- `apps/mobile/app.config.ts`
- `apps/mobile/src/components/animated-icon.tsx`

**3 files added:**

- `apps/mobile/src/constants/theme.ts` — `SPLASH_COLORS`
- `apps/mobile/src/__tests__/animated-splash-screen.test.tsx`
- `.github/workflows/ci-bundle-size.yml` — `APP_VERSION_NAME` placeholder

**2 files modified (tooling):**

- `Makefile` — `doctor-ci --scope changed`
- `.githooks/pre-commit` — fail-fast

## Acceptance Criteria

| AC                                                    | Result  |
| ----------------------------------------------------- | ------- |
| AC1 — CI fails if semver cannot be extracted          | ✅ PASS |
| AC2 — app.config.ts fails if APP_VERSION_NAME missing | ✅ PASS |
| AC3 — Splash shows version                            | ✅ PASS |
| AC4 — Color staging vs production correct             | ✅ PASS |
| AC5 — Null-safe runtime                               | ✅ PASS |
| AC6 — 2000ms duration                                 | ✅ PASS |
| AC7 — Both workflows have version-name step           | ✅ PASS |
| AC8 — app.config.ts no longer hardcodes version       | ✅ PASS |

**8/8 PASS — 0 FAIL**

## Implementation Tasks

| #   | Task                                    | Status |
| --- | --------------------------------------- | ------ |
| 1   | Extract semver — Production CI          | ✅     |
| 2   | Extract semver — Staging CI             | ✅     |
| 3   | Guard APP_VERSION_NAME in app.config.ts | ✅     |
| 4   | Render version in animated-icon.tsx     | ✅     |
| 5   | Centralize SPLASH_COLORS in theme.ts    | ✅     |
| 6   | Unit tests                              | ✅     |
| 7   | Bundle-size CI fix                      | ✅     |
| 8   | Doctor-ci + pre-commit fix              | ✅     |

**All tasks complete. No unchecked `- [ ]` tasks.**

## Test Results

```
PASS src/__tests__/animated-splash-screen.test.tsx
  AnimatedSplashOverlay
    ✓ renders version text when both version and build are present (20 ms)
    ✓ does not render version text when nativeApplicationVersion is null (1 ms)
    ✓ does not render version text when nativeBuildVersion is null (1 ms)
```

**66 suites, 496 tests — all passing. TypeScript and lint clean.**

## Domains Synced

None — no canonical specs were modified by this change.

## Risks

| Risk                     | Mitigation                                         |
| ------------------------ | -------------------------------------------------- |
| Low — CI-centric changes | Validated by CI run on PR #337 (all checks passed) |
| Low — visual component   | Verified visually; Tests cover null-safety         |

## Archived Path

`openspec/changes/archive/2026-07-26-splash-version/`

## Engram Observation IDs

- Proposal: 96
- Spec: 97
- Design: 98
- Tasks: 99
- Apply Progress: 100
- Verify Report: 101
- Archive Report: 102 (engram) + this file
