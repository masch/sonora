# Archive Report: split-api-staging-deploy

**Archived**: 2026-07-03
**Status**: success — intentional-with-warnings (none)

## Executive Summary

Split the single `deploy-api-staging.yml` GitHub Actions workflow into two separate workflows — `validate-api-staging.yml` (PR validation, no secrets) and `deploy-api-staging.yml` (push to main only, secrets available) — to eliminate false-negative failures from Dependabot PRs where GitHub Actions does not expose secrets for `pull_request` events. All 5 tasks completed, all 11 spec scenarios compliant, 0 issues, `make validate` passes (503 tests).

## Change Cycle

| Phase    | Status      | Observation ID |
| -------- | ----------- | -------------- |
| Proposal | ✅ Complete | #3034          |
| Spec     | ✅ Complete | #3035          |
| Design   | ✅ Complete | #3036          |
| Tasks    | ✅ Complete | #3037          |
| Apply    | ✅ Complete | #3038          |
| Verify   | ✅ PASS     | #3039          |
| Archive  | ✅ Complete | (this report)  |

## What Was Done

### Problem

Dependabot PRs touching `apps/api/**` or `packages/shared/**` triggered the single `deploy-api-staging.yml` workflow, which failed at the DB migration step because GitHub Actions does not expose secrets to Dependabot-triggered `pull_request` runs. `DATABASE_URL` was empty, `drizzle-kit migrate` exited with code 2 — a false negative.

### Solution

- **Created** `.github/workflows/validate-api-staging.yml` — PR validation workflow with `pull_request` trigger, path filters, checkout@v4, no environment, no secrets. Runs `bun install --frozen-lockfile`, `make api-validate`, and a change-type classification step.
- **Modified** `.github/workflows/deploy-api-staging.yml` — removed `pull_request` trigger, kept `push` to `main` and `workflow_dispatch`. Bumped `actions/checkout@v4` to `v5`. Renamed concurrency group to `deploy-api-staging-${{ github.ref }}`.

### Key Decisions

- Change-type detection uses `git diff --name-only` against `github.event.pull_request.base.sha` — simplest approach
- Validate workflow uses checkout@v4 (no secrets, no history needed)
- Deploy workflow upgraded to checkout@v5 (consistent with mobile-staging pattern)
- Concurrency groups named differently per workflow to avoid collisions
- `workflow_dispatch` intentionally bypasses path filters (existing behavior preserved)

### Files Changed

| File                                         | Action                                                           |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `.github/workflows/validate-api-staging.yml` | Created (45 lines)                                               |
| `.github/workflows/deploy-api-staging.yml`   | Modified (~60 lines changed)                                     |
| `openspec/specs/ci/spec.md`                  | Modified — added CI.3, CI.4                                      |
| `openspec/specs/deployment/spec.md`          | Modified — added Deploy Trigger Policy, Idempotent Staging Steps |

## Specs Synced

| Domain             | Action  | Details                                                                                                |
| ------------------ | ------- | ------------------------------------------------------------------------------------------------------ |
| CI/CD Integrations | Updated | Added 2 requirements (CI.3 Workflow Trigger Separation, CI.4 Change-Type Classification) — 8 scenarios |
| Deployment         | Updated | Added 2 requirements (Deploy Trigger Policy, Idempotent Staging Steps) — 5 scenarios                   |

## Verification Results

- **Verdict**: PASS
- **Tasks**: 5/5 complete, 0 incomplete
- **Spec compliance**: 11/11 scenarios compliant
- **Tests**: 503 passed (382 mobile + 77 API + 44 shared)
- **Issues**: 0 CRITICAL, 0 WARNING, 0 SUGGESTION
- **TDD compliance**: N/A (pure YAML config change — no application code changed)

## Archive Contents

- `proposal.md` ✅
- `specs/ci/spec.md` ✅
- `specs/deployment/spec.md` ✅
- `design.md` ✅
- `tasks.md` ✅ (5/5 tasks complete)
- `apply-progress.md` ✅
- `verify-report.md` ✅
- `archive-report.md` ✅ (this file)

## Risks

None. The change is purely structural YAML workflow configuration with identical validation steps in both workflows. Rollback plan: restore original `deploy-api-staging.yml` from git, delete `validate-api-staging.yml`.

## SDD Cycle Complete

The change has been fully planned, specified, designed, implemented, verified, and archived. Ready for the next change.
