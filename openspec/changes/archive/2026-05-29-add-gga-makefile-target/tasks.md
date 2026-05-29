# Tasks: Add make gga target

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~10 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Makefile changes

- [x] **1.1** Rename `.PHONY: validate` → `.PHONY: validate-static` (same deps `test lint typecheck`, CI section), update help to `## Run CI gate without GGA (test → lint → typecheck)`
- [x] **1.2** Add `# ── Review ──` section between CI and Maintenance blocks; add `.PHONY: gga` with command `gga run` and help `## Run GGA (Gentleman Guardian Angel) code review`
- [x] **1.3** Add new `.PHONY: validate` that depends on `validate-static gga`, help `## Run full CI gate with GGA review (test → lint → typecheck → gga)`
- [x] **1.4** Verify `make help` shows all three targets (`validate`, `validate-static`, `gga`) with correct descriptions; verify `make validate-static` runs test→lint→typecheck; verify `make gga` runs `gga run`
