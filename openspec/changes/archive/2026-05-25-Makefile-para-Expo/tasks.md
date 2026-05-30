# Tasks: Makefile-para-Expo

## Review Workload Forecast

| Field                   | Value          |
| ----------------------- | -------------- |
| Estimated changed lines | ~100           |
| 400-line budget risk    | Low            |
| Chained PRs recommended | No             |
| Suggested split         | single PR      |
| Delivery strategy       | ask-on-risk    |
| Chain strategy          | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                 | Likely PR     | Notes                                   |
| ---- | -------------------- | ------------- | --------------------------------------- |
| 1    | Makefile + TDD infra | PR 1 (single) | All changes in one PR, ~100 lines total |

## Phase 1: Dependencies & Config Setup

- [x] 1.1 Install dev deps: `bunx expo install --dev jest-expo jest @types/jest @testing-library/react-native`
- [x] 1.2 Add `jest` config block to `package.json` with `preset: "jest-expo"` and `transformIgnorePatterns`
- [x] 1.3 Add `"test": "jest --watchAll"` script to `package.json`
- [x] 1.4 Add `"types": ["jest"]` to `compilerOptions` in `tsconfig.json`

## Phase 2: Makefile

- [x] 2.1 Create root `Makefile` with 13 targets: `start` (default), `dev-web`, `dev-android`, `dev-ios`, `doctor`, `install`, `lint`, `typecheck`, `test`, `validate`, `clean`, `reset`, `help`
- [x] 2.2 Phony declarations, ordered: convenience → utilities → test → CI → maintenance
- [x] 2.3 `validate` runs `test && lint && typecheck` (tests first)
- [x] 2.4 `help` auto-generates list via `@grep -E '^[a-zA-Z_-]+:' Makefile

## Phase 3: Config Sync

- [x] 3.1 Update `openspec/config.yaml` testing section: set `runner: jest`, `runner_available` to `[jest]`, and enable `unit: true`

## Phase 4: Verify

- [x] 4.1 Run `make install` → verify deps installed without errors
- [x] 4.2 Run `make typecheck` → verify `tsc --noEmit` passes
- [x] 4.3 Run `make help` → verify all 13 targets listed
- [x] 4.4 Run `make test` → verify Jest boots with jest-expo preset (no test files yet, should report "no tests found")
