# Tasks: fix-expo-doctor-warnings

## Review Workload Forecast

| Field                   | Value                                                     |
| ----------------------- | --------------------------------------------------------- |
| Estimated changed lines | ~8 (package.json only; binary icons excluded from budget) |
| 400-line budget risk    | Low                                                       |
| Chained PRs recommended | No                                                        |
| Suggested split         | Single PR                                                 |
| Delivery strategy       | ask-on-risk                                               |
| Chain strategy          | pending                                                   |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                       | Likely PR | Notes                                          |
| ---- | -------------------------- | --------- | ---------------------------------------------- |
| 1    | All 3 fixes + verification | PR 1      | Single PR; changes are orthogonal and low-risk |

## Phase 1: Icon Assets

- [x] 1.1 Inspect `assets/images/icon.png`, `android-icon-foreground.png`, `android-icon-monochrome.png` with `identify`; backup originals via `cp`
- [x] 1.2 Run `magick` resize (fit 1024×1024) + extent/gravity center to pad to square on all 3 files
- [x] 1.3 Verify all 3 files are 1024×1024 PNG via `identify`; no visual artifacts

## Phase 2: Dependencies

- [x] 2.1 Run `npx expo install expo-asset` to add missing dependency to `package.json`
- [x] 2.2 Run `npx expo install --check` and accept suggested patch bumps for `@expo/ui`, `expo`, `expo-constants`, `expo-linking`, `expo-router`
- [x] 2.3 Verify `package.json` and `bun.lock` updated; run `bun install` if lockfile stale

## Phase 3: Verification & Commit

- [x] 3.1 Run `make validate` (format + lint + typecheck + tests) — confirm all pass
- [x] 3.2 Run `npx expo-doctor` — confirm exit 0 with all 21 checks passing
- [x] 3.3 Commit changes with conventional commit message (e.g., `chore: fix expo doctor warnings — icons, expo-asset dep, patch bumps`)
