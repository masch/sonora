# Archive Report — security-pipeline

**Status**: PASS ✅ — Archive complete
**Date**: 2026-07-08
**Artifact Store**: hybrid (openspec + engram)

## Artifacts Read

| Artifact                  | Path / Topic Key                                                      | Status  |
| ------------------------- | --------------------------------------------------------------------- | ------- |
| Proposal                  | `openspec/changes/security-pipeline/proposal.md`                      | ✅      |
| Spec — Version Pinning    | `openspec/changes/security-pipeline/specs/version-pinning/spec.md`    | ✅      |
| Spec — CI                 | `openspec/changes/security-pipeline/specs/ci/spec.md`                 | ✅      |
| Spec — Dependency Updates | `openspec/changes/security-pipeline/specs/dependency-updates/spec.md` | ✅      |
| Design                    | `openspec/changes/security-pipeline/design.md`                        | ✅      |
| Tasks                     | `openspec/changes/security-pipeline/tasks.md`                         | ✅      |
| Apply Progress            | `openspec/changes/security-pipeline/apply-progress.md`                | ✅      |
| Verify Report             | `openspec/changes/security-pipeline/verify-report.md`                 | ✅ PASS |

## Final Task Completion Gate

Re-read `tasks.md` for unchecked implementation task markers: **No `- [ ]` markers found**. All 5 tasks are marked complete ✅. No stale-checkbox reconciliation needed.

## Domains Synced

### 1. `version-pinning` — New canonical spec

- **Canonical path**: `openspec/specs/version-pinning/spec.md`
- **Requirements added**: PIN.1, PIN.2, PIN.3, PIN.4

### 2. `dependency-updates` — New canonical spec

- **Canonical path**: `openspec/specs/dependency-updates/spec.md`
- **Requirements added**: DEP.1, DEP.2, DEP.3, DEP.4, DEP.5, DEP.6

### 3. `ci` — Existing canonical spec (append)

- **Canonical path**: `openspec/specs/ci/spec.md`
- **ADDED Requirements**: CI.5 (Security Audit Workflow), CI.6 (Security Notification - Optional)
- **MODIFIED Requirements**: None
- **REMOVED Requirements**: None

### Active same-domain change warning

⚠️ `openspec/changes/gh-ci-refactor/specs/ci/spec.md` also targets the CI domain with its own CI.5 (Composite Bun Setup Action), CI.6 (Workflow Naming Convention), and CI.7 (Configurable Mobile Staging Deploy). The numbering collision (CI.5 and CI.6 are different requirements across the two changes) is acknowledged. Both sets coexist in the canonical spec until `gh-ci-refactor` is synced and archived. Manual numbering reconciliation may be needed when both are merged.

## What Was Accomplished

### Domain 1: Version Pinning

- **Created** `scripts/pin-deps.ts` — one-time script that reads resolved versions from `node_modules` and pins all range constraints (`^`, `~`, `*`) to exact versions
- **Added** `make pin-deps` target to `Makefile`
- **Pinned 26 version constraints** across 4 `package.json` files:
  - `apps/api/package.json` — 12 deps pinned
  - `apps/mobile/package.json` — 10 deps pinned
  - `apps/admin/package.json` — 2 deps pinned
  - `packages/shared/package.json` — 2 deps pinned
- **Verified**: `bun install --frozen-lockfile` passes, lockfile unchanged

### Domain 2: Security Audit Workflow

- **Created** `.github/workflows/security-audit.yml`
  - Weekly schedule (Mon 06:00 UTC) + `workflow_dispatch`
  - `bun audit --format=json` with severity threshold checking (default: `moderate`)
  - `github-script` parse step with JSON/plain-text fallback
  - Conditional workflow failure on findings above threshold
  - Optional GitHub Issue creation via `create_issue` input
  - Step summary (`$GITHUB_STEP_SUMMARY`) with findings table

### Domain 3: Renovate Configuration

- **Created** `renovate.json` at repository root
  - `enabledManagers: ["bun"]` — Bun-only dependency management
  - `rangeStrategy: "pin"` — exact versions on updates
  - Weekly schedule (`before 6am on Monday`)
  - Dependency dashboard enabled
  - No automerge

### Tests Added

- `apps/api/src/__tests__/pinned-deps.test.ts` — 5 tests covering all 4 target files for range-constraint absence

## Implementation Tasks

| Task                                                   | Status      | Verification                          |
| ------------------------------------------------------ | ----------- | ------------------------------------- |
| Task 1 — Create `scripts/pin-deps.ts`                  | ✅ Complete | Script exists, no type errors         |
| Task 2 — Add `pin-deps` target to Makefile             | ✅ Complete | `make help` shows target              |
| Task 3 — Pin all dependencies                          | ✅ Complete | 26 pinned, install integrity verified |
| Task 4 — Create `renovate.json`                        | ✅ Complete | Valid JSON, all required fields       |
| Task 5 — Create `.github/workflows/security-audit.yml` | ✅ Complete | Valid YAML, all CI.5/CI.6 scenarios   |

## Files Created / Modified

| File                                                                  | Action                             |
| --------------------------------------------------------------------- | ---------------------------------- |
| `scripts/pin-deps.ts`                                                 | Created                            |
| `Makefile`                                                            | Modified (added `pin-deps` target) |
| `apps/api/package.json`                                               | Modified (12 deps pinned)          |
| `apps/mobile/package.json`                                            | Modified (10 deps pinned)          |
| `apps/admin/package.json`                                             | Modified (2 deps pinned)           |
| `packages/shared/package.json`                                        | Modified (2 deps pinned)           |
| `renovate.json`                                                       | Created                            |
| `.github/workflows/security-audit.yml`                                | Created                            |
| `apps/api/src/__tests__/pinned-deps.test.ts`                          | Created                            |
| `openspec/changes/security-pipeline/proposal.md`                      | Existing (archived)                |
| `openspec/changes/security-pipeline/specs/version-pinning/spec.md`    | Existing (archived)                |
| `openspec/changes/security-pipeline/specs/ci/spec.md`                 | Existing (archived)                |
| `openspec/changes/security-pipeline/specs/dependency-updates/spec.md` | Existing (archived)                |
| `openspec/changes/security-pipeline/design.md`                        | Existing (archived)                |
| `openspec/changes/security-pipeline/tasks.md`                         | Existing (archived)                |
| `openspec/changes/security-pipeline/apply-progress.md`                | Existing (archived)                |
| `openspec/changes/security-pipeline/verify-report.md`                 | Existing (archived)                |
| `openspec/changes/security-pipeline/sync-report.md`                   | Created                            |
| `openspec/changes/security-pipeline/archive-report.md`                | Created                            |

## Canonical Specs Updated

| Domain             | Path                                        | Action                       |
| ------------------ | ------------------------------------------- | ---------------------------- |
| version-pinning    | `openspec/specs/version-pinning/spec.md`    | Created                      |
| dependency-updates | `openspec/specs/dependency-updates/spec.md` | Created                      |
| ci                 | `openspec/specs/ci/spec.md`                 | Merged (CI.5, CI.6 appended) |

## Next Steps

1. **Commit and push** the PR with all changes
2. **Onboard Renovate Community Cloud app** on the repository post-merge:
   - Visit `https://github.com/apps/renovate` and install on the sonora repo
   - Renovate will detect `renovate.json` and begin scanning on the weekly schedule
   - First run should populate the Dependency Dashboard (or report all deps up to date)
3. **Test security-audit workflow** via `workflow_dispatch` after merge
4. **Monitor** the first scheduled security audit run (next Monday 06:00 UTC)

## Destructive Merge Approvals

Not applicable — no destructive changes.

## Risks at Archive Time

| Risk                                                  | Severity | Status                       |
| ----------------------------------------------------- | -------- | ---------------------------- |
| DEP.6 pending Renovate onboarding (post-merge)        | Low      | Acknowledged — not a blocker |
| CI.5/CI.6 numbering collision with `gh-ci-refactor`   | Low      | Documented in sync report    |
| Pre-existing root `package.json` diff (`@types/node`) | Note     | Unrelated to this change     |

## Archived Path

`openspec/changes/security-pipeline/` → `openspec/changes/archive/2026-07-08-security-pipeline/`

## Memory Observation IDs

- `sdd/security-pipeline/archive-report` → saved to engram
