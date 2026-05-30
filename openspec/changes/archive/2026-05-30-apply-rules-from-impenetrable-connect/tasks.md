# Tasks: apply-rules-from-impenetrable-connect

## Review Workload Forecast

~150–200 lines across ~8 files. Single PR is reasonable; chained PRs available by phase if preferred.

| Field                   | Value                                                           |
| ----------------------- | --------------------------------------------------------------- |
| Estimated changed lines | 150–200                                                         |
| 400-line budget risk    | Low                                                             |
| Chained PRs recommended | Yes (optional — single PR also viable)                          |
| Suggested split         | Single PR, or PR 1 (ESLint + AGENTS.md) → PR 2 (Logger + CI/CD) |
| Delivery strategy       | ask-on-risk                                                     |
| Chain strategy          | pending                                                         |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                     | Likely PR | Notes                             |
| ---- | ------------------------ | --------- | --------------------------------- |
| 1    | ESLint rules + AGENTS.md | PR 1      | Config + docs — no code, low risk |
| 2    | Logger + CI/CD           | PR 2      | Infrastructure + automation       |

## Phase 1 — ESLint Rules

- [x] 1.1 Add `no-console` (warn) to eslint.config.js with allow list for `logger.*` calls
- [x] 1.2 Add `@typescript-eslint/consistent-type-definitions` (error) enforcing interface over type for objects
- [x] 1.3 Evaluate and add `no-magic-numbers` (warn) — DEFERRED: too noisy for RN/Expo codebase
- [x] 1.4 Run `make lint` and verify all 3 rules pass with zero violations on existing code

## Phase 2 — AGENTS.md Conventions

- [x] 2.1 Document component patterns: ScreenWrapper, ThemedText, Icon, HintRow, Collapsible, app-tabs
- [x] 2.2 Document navigation: file-based routing in src/app/, app-tabs for tab bars
- [x] 2.3 Document styles: Tailwind/NativeWind via className, CSS variables, no inline styles
- [x] 2.4 Document animations: expo-reanimated + animated-icon + web CSS transitions
- [x] 2.5 Document testing: test file locations (`__tests__/`), coverage scope, testing-library queries
- [x] 2.6 Document accessibility: accessibilityLabel on pressables, alt on Image, testID (kebab-case)
- [x] 2.7 Document async states: LoadingView, empty state, error state with retry
- [x] 2.8 Document i18n: useTranslation hook, no hardcoded strings (enforced by ESLint rule)
- [x] 2.9 Document git: branch naming (feat/fix/chore/refactor), PR body what+why, no push to main, no --no-verify, no --amend

## Phase 3 — Logger

- [x] 3.1 Create src/utils/logger.ts exporting debug/info/warn/error; suppress debug+info when `!__DEV__`
- [x] 3.2 Search codebase for console.log/warn/error calls and migrate to logger.\* (if any exist)
- [x] 3.3 Verify no-console rule allows logger._ and warns on remaining console._ calls
- [x] 3.4 Confirm `make lint` passes and logger handles edge cases (no message, metadata)

## Phase 4 — CI/CD

- [x] 4.1 Create .github/workflows/pr.yml: pull_request trigger → checkout → bun install → make check → bunx react-doctor@latest
- [x] 4.2 Create .github/workflows/commitlint.yml validating PR title matches conventional commit format
- [x] 4.3 Add `doctor: bunx react-doctor@latest` target to Makefile
- [x] 4.4 Add `doctor` to Makefile `check` target after typecheck
- [x] 4.5 Document manual test steps: deferred to verify phase — CI workflows are not testable locally without GitHub Actions
