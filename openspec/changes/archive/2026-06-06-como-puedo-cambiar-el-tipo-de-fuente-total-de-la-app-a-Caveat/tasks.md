# Tasks: Cambiar fuente global a Caveat

## Review Workload Forecast

| Field                   | Value       |
| ----------------------- | ----------- |
| Estimated changed lines | ~15         |
| 400-line budget risk    | Low         |
| Chained PRs recommended | No          |
| Suggested split         | Single PR   |
| Delivery strategy       | ask-on-risk |
| Chain strategy          | pending     |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                                         | Likely PR | Notes                                              |
| ---- | ------------------------------------------------------------ | --------- | -------------------------------------------------- |
| 1    | Replace Spline Sans with Caveat across config, CSS, and spec | PR 1      | Single PR targeting main; ~15 lines across 4 files |

## Phase 1: Foundation

- [x] 1.1 Install `@expo-google-fonts/caveat` via `bunx expo install @expo-google-fonts/caveat`

## Phase 2: Core Implementation

- [x] 2.1 Add `expo-font` config plugin to `app.config.ts` — 4-weight fonts array referencing `@expo-google-fonts/caveat/*.ttf`
- [x] 2.2 Update `src/global.css`:
  - Replace `Spline Sans` with `Caveat` as first value in `--font-sans` cascade
  - Remove `@media ios { --font-sans: system-ui }` override (keep other iOS overrides)
- [x] 2.3 Update `openspec/specs/nativewind-styling/spec.md` line 36 — `Spline Sans` → `Caveat`

## Phase 3: Build & Verify

- [x] 3.1 Run `npx expo prebuild` — generates native projects with embedded `.ttf` files
- [x] 3.2 Run `make typecheck` — verify TypeScript + lint pass
- [x] 3.3 Run `make validate` — full validation gate
- [ ] 3.4 Manual visual check: confirm Caveat renders in 4 weights (`font-normal`, `font-medium`, `font-semibold`, `font-bold`)
