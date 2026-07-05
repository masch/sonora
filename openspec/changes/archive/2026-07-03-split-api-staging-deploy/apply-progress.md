# Apply Progress: Split API Staging Deploy

## Status

**All 5 tasks complete.** Ready for verify.

## TDD Cycle Evidence

| Task | Test File         | Layer      | Safety Net       | RED                  | GREEN                                                                  | TRIANGULATE             | REFACTOR       |
| ---- | ----------------- | ---------- | ---------------- | -------------------- | ---------------------------------------------------------------------- | ----------------------- | -------------- |
| 1.1  | N/A (YAML config) | Structural | ✅ 52/52 suites  | ➖ Purely structural | ✅ Created `validate-api-staging.yml`                                  | ➖ Structural (skipped) | ➖ None needed |
| 1.2  | N/A (YAML config) | Structural | ✅ Same baseline | ➖ Purely structural | ✅ Steps included in new file                                          | ➖ Structural (skipped) | ➖ None needed |
| 1.3  | N/A (YAML config) | Structural | ✅ Same baseline | ➖ Purely structural | ✅ Change-type detection step included                                 | ➖ Structural (skipped) | ➖ None needed |
| 1.4  | N/A (YAML config) | Structural | ✅ Same baseline | ➖ Purely structural | ✅ Concurrency + env added                                             | ➖ Structural (skipped) | ➖ None needed |
| 2.1  | N/A (YAML config) | Structural | ✅ Same baseline | ➖ Purely structural | ✅ `pull_request` → `push` + kept `workflow_dispatch`                  | ➖ Structural (skipped) | ➖ None needed |
| 2.2  | N/A (YAML config) | Structural | ✅ Same baseline | ➖ Purely structural | ✅ `checkout@v4` → `checkout@v5`                                       | ➖ Structural (skipped) | ➖ None needed |
| 2.3  | N/A (YAML config) | Structural | ✅ Same baseline | ➖ Purely structural | ✅ Concurrency group renamed to `deploy-api-staging-${{ github.ref }}` | ➖ Structural (skipped) | ➖ None needed |
| 2.4  | N/A (YAML config) | Structural | ✅ Same baseline | ➖ Purely structural | ✅ Comment updated/removed (concurrency now describes push)            | ➖ Structural (skipped) | ➖ None needed |

## Triangulation Skip Rationale

All tasks are purely structural YAML workflow configuration files — no branching logic, no functions, no testable code paths. By strict-tdd.md rules: "purely structural (config file, constant definition, type export)" with "literally ONE possible output (no branching, no logic)" — triangulation skipped for all tasks.

## Completed Tasks

### Phase 1: New Validation Workflow

- [x] 1.1 Created `.github/workflows/validate-api-staging.yml` — PR trigger on main with path filters (`apps/api/**`, `packages/shared/**`, `.github/workflows/**`, `Makefile`), no environment, no secrets
- [x] 1.2 Added steps: `actions/checkout@v4`, `oven-sh/setup-bun@v2`, clean tsconfig, `bun install --frozen-lockfile`, `make api-validate`
- [x] 1.3 Added change-type detection step using `git diff --name-only` against `github.event.pull_request.base.sha` — classifies as `source-code` or `deps-only`
- [x] 1.4 Added concurrency group `validate-api-staging-${{ github.ref }}` with `cancel-in-progress: true` and `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`

### Phase 2: Modified Deploy Workflow

- [x] 2.1 Replaced `pull_request` trigger with `push` on `main`; kept `workflow_dispatch`
- [x] 2.2 Bumped `actions/checkout@v4` → `actions/checkout@v5`
- [x] 2.3 Renamed concurrency group to `deploy-api-staging-${{ github.ref }}`
- [x] 2.4 Removed "Cancel previous runs for the same PR" comment (trigger is now push, not PR)

## Files Changed

| File                                         | Action   | What Was Done                                                                                             |
| -------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `.github/workflows/validate-api-staging.yml` | Created  | New validation workflow for PRs — no secrets, runs api-validate + change-type detection                   |
| `.github/workflows/deploy-api-staging.yml`   | Modified | Changed trigger from `pull_request` to `push` on `main`, bumped checkout to v5, renamed concurrency group |

## Deviations from Design

None — implementation matches design.md exactly.

## Issues Found

None.

## Verification

`make validate` passes: 52 test suites (382 tests) in mobile, 8 test files (77 tests) in API, 3 test files (44 tests) in shared — same baseline as pre-implementation safety net.

## Delivery

- Mode: Single PR (ask-on-risk, Low budget risk)
- Estimated changed lines: ~100
- Boundary: Full change (no chaining needed)
