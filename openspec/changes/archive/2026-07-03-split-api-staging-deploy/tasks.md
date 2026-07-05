# Tasks: Split API Staging Deploy into Validation + Deploy Workflows

## Review Workload Forecast

| Field                   | Value                       |
| ----------------------- | --------------------------- |
| Estimated changed lines | ~100 (60 new + 40 modified) |
| 400-line budget risk    | Low                         |
| Chained PRs recommended | No                          |
| Suggested split         | Single PR                   |
| Delivery strategy       | ask-on-risk                 |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                      | Likely PR | Notes                                                                                                             |
| ---- | ----------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| 1    | Create validate + modify deploy workflows | Single PR | Both changes are small (100 lines total), tightly coupled, and independent tests cannot exist until both are live |

## Phase 1: New Validation Workflow

- [x] 1.1 Create `.github/workflows/validate-api-staging.yml` — PR trigger on main, path filters (`apps/api/**`, `packages/shared/**`, `.github/workflows/**`, `Makefile`), no environment, no secrets
- [x] 1.2 Add steps: `actions/checkout@v4`, `oven-sh/setup-bun@v2`, clean tsconfig, `bun install --frozen-lockfile`, `make api-validate`
- [x] 1.3 Add change-type detection step using `git diff --name-only` against `github.event.pull_request.base.sha` — classify as `source-code` or `deps-only` with `GITHUB_OUTPUT` and `GITHUB_STEP_SUMMARY`
- [x] 1.4 Add concurrency group `validate-api-staging-${{ github.ref }}` with `cancel-in-progress: true` and env `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`

## Phase 2: Modify Deploy Workflow

- [x] 2.1 In `.github/workflows/deploy-api-staging.yml`: replace `pull_request` trigger with `push` targeting `main`; keep `workflow_dispatch`
- [x] 2.2 Bump `actions/checkout@v4` → `actions/checkout@v5`
- [x] 2.3 Rename concurrency group from `${{ github.workflow }}-${{ github.ref }}` to `deploy-api-staging-${{ github.ref }}`
- [x] 2.4 Update comment above concurrency block to reference push instead of PR
