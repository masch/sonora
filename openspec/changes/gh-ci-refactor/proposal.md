# Proposal: GitHub Actions CI Workflow Refactor

## Intent

14 workflows with inconsistent naming, 18 duplicate `bun install` blocks (Issue #229), 3 checkout versions (v4/v5), stale `--minimum-release-age=0` flag. Refactor cuts boilerplate ~70% and enforces a single naming convention.

## Scope

**In**: composite action `.github/actions/setup/action.yml` | replace 18 bun install | remove `--minimum-release-age=0` | rename 9 files via `git mv` | update workflow_call refs | add deploy-mobile-staging dispatch inputs | create 5 new workflows

**Out**: merge mobile web/android deploy files | change build/deploy logic | migrate to reusable workflows | add new environments

## Capabilities

**New**: `ci/bundle-size`, `ci/auto-assign`, `deploy-admin-staging-auto`, `admin/cleanup`, `admin/db-backup`

**Modified**: None

## Approach

(1) Composite action: checkout@v5 (fetch-depth input) → setup-bun@v2 → cache@v5 (`bun-${{ hashFiles('bun.lock') }}`, restore-keys fallback, node_modules glob) → `bun install --frozen-lockfile`. (2) Replace 18 inline blocks + strip stale flag. (3) `git mv` + refs. (4) 5 new workflows.

## Delivery Plan

| PR  | Contents                                                                    | Dep  |
| --- | --------------------------------------------------------------------------- | ---- |
| 1   | Composite action + replace bun install + remove flag + standardize checkout | —    |
| 2   | `git mv` 9 files + update workflow_call refs                                | PR 1 |
| 3+  | New workflows (can split further)                                           | PR 2 |

## New Workflows

| File                            | Trigger      | Purpose                               |
| ------------------------------- | ------------ | ------------------------------------- |
| `ci-bundle-size.yml`            | PRs to main  | Bundle size diff, fail over threshold |
| `ci-auto-assign.yml`            | PR events    | Path-based reviewer auto-assignment   |
| `deploy-admin-staging-auto.yml` | Push to main | Auto-deploy admin web to staging      |
| `admin-cleanup.yml`             | Monthly cron | Stale issues/branches/artifacts       |
| `admin-db-backup.yml`           | Weekly cron  | pg_dump → encrypted R2                |

## Risks

| Risk                                 | Likelihood | Mitigation                                       |
| ------------------------------------ | ---------- | ------------------------------------------------ |
| Rename breaks workflow_call refs     | Low        | `git mv` preserves history; verify targets       |
| Cache mismatch from path differences | Low        | Test composite action on all 10 workflows first  |
| New workflows increase CI cost       | Med        | Bundle size on labeled PRs only; backup off-peak |

## Rollback

- **PR 1**: revert commit — old inline code in git history
- **PR 2**: `git revert` — `git mv` back + restore refs
- **PR 3+**: delete new files — no pipeline impact

## Dependencies

R2 bucket (db-backup), CODEOWNERS or path-based assignment (auto-assign)

## Success Criteria

- [ ] All 14 workflows pass on a branch PR
- [ ] Zero `bun install` in workflows (was 18)
- [ ] Zero `--minimum-release-age` in workflows
- [ ] All 14 filenames match `{category}-{app}(-{env}).yml`
- [ ] Cache hit saves ≥20s per job that had bun install
