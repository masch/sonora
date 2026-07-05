# Proposal: Split API Staging Deploy into Validation + Deploy Workflows

## Intent

Dependabot PRs (e.g. vitest 3→4 bump) that touch `apps/api/**` or `packages/shared/**` trigger the single `deploy-api-staging.yml` workflow. That workflow fails at the DB migration step because GitHub Actions **does not expose secrets to Dependabot-triggered runs** — `DATABASE_URL` is empty, `drizzle-kit migrate` exits with code 2. The failure is a false negative: a platform restriction, not a real problem with the dependency.

Split into two workflows so validation runs on every PR (safe, no secrets needed) and deployment only runs on `push` to `main` (where secrets are available).

## Scope

### In Scope

- Validation workflow triggered by `pull_request` to `main` on path changes
- Deploy workflow triggered by `push` to `main` on same paths
- Change-type detection step to distinguish deps-only from source changes
- Removal of `pull_request` trigger from the original deploy workflow

### Out of Scope

- Production API deployment changes
- Mobile or web deploy workflow changes
- Secrets management improvements beyond the split

## Capabilities

### New Capabilities

None — this is a CI pipeline refactor; no new domain features.

### Modified Capabilities

- `ci`: Add trigger conditions distinguishing validation (PR) from deploy (push). Add change-type detection step.
- `deployment`: Staging deployment trigger changes from `pull_request + push` to `push`-only on `main`.

## Approach

1. Rename the existing `deploy-api-staging.yml` to `deploy-api-staging.yml` — the deploy workflow, retaining `push` to `main` trigger only.
2. Create `validate-api-staging.yml` — validation workflow with `pull_request` trigger, running checkout → bun install → `make api-validate` + a change-type detection step.
3. The validation workflow reports success without deployment steps (no secrets needed).
4. The deploy workflow retains `make api-validate`, migration, seed, and deploy steps with full secret access.

## Affected Areas

| Area                                         | Impact   | Description                                          |
| -------------------------------------------- | -------- | ---------------------------------------------------- |
| `.github/workflows/deploy-api-staging.yml`   | Modified | Remove `pull_request` trigger, keep `push` to `main` |
| `.github/workflows/validate-api-staging.yml` | New      | Validation-only workflow for PRs                     |
| `openspec/specs/ci/spec.md`                  | Modified | Add trigger condition requirements                   |
| `openspec/specs/deployment/spec.md`          | Modified | Update deploy trigger conditions                     |

## Risks

| Risk                                                         | Likelihood | Mitigation                                      |
| ------------------------------------------------------------ | ---------- | ----------------------------------------------- |
| Validation workflow misses a failure that deploy would catch | Low        | Both run `make api-validate` — identical checks |
| Push triggers deploy before migration is safe                | Low        | Migrations are idempotent (`api-db-migrate-ci`) |

## Rollback Plan

Restore the original single-workflow file from git: `git checkout HEAD~1 -- .github/workflows/deploy-api-staging.yml`. Delete `validate-api-staging.yml`.

## Dependencies

None. No external service changes needed.

## Success Criteria

- [ ] Dependabot PRs pass validation without hitting DB migration step
- [ ] Push to `main` still deploys to staging with migrations + seed + deploy
- [ ] `make api-validate` runs identically in both workflows
