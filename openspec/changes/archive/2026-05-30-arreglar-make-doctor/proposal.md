# Proposal: arreglar make doctor

## Intent

`make doctor` runs `bunx react-doctor@latest` with no flags — hides most diagnostics (no `--verbose`), always full scan (no `--diff`), always exits 0 (no `--fail-on`). Fix it to match the react-doctor skill's two Makefile-appropriate workflows.

## Scope

### In Scope

- Update `doctor` target: add `--verbose` flag for full codebase audit
- Add `doctor-diff` target: `--verbose --diff --fail-on warning` for regression checking
- Document both targets in Makefile comments

### Out of Scope

- `/doctor` agent-driven triage workflow (not replicable in Makefile)
- CI workflow changes (`.github/workflows/pr.yml` already uses `millionco/react-doctor@main`)
- `--score` target (nice-to-have, no workflow need)

## Capabilities

### New Capabilities

None — pure config change, no spec-level behavior changes.

### Modified Capabilities

None — no existing capability's requirements change.

## Approach

Replace the single `doctor` target with two targets:

1. **`make doctor`** → `bunx react-doctor@latest --verbose` — full codebase audit matching the skill's "full cleanup" workflow.
2. **`make doctor-diff`** → `bunx react-doctor@latest --verbose --diff --fail-on warning` — regression check matching the skill's "changed files only" workflow.

Add both to the `.PHONY` declaration. The CI action and all other targets remain untouched.

## Affected Areas

| Area       | Impact   | Description                                             |
| ---------- | -------- | ------------------------------------------------------- |
| `Makefile` | Modified | Replace `doctor` target flags, add `doctor-diff` target |

## Risks

| Risk                                                         | Likelihood | Mitigation                                                         |
| ------------------------------------------------------------ | ---------- | ------------------------------------------------------------------ |
| `--fail-on warning` too noisy on pre-existing issues in diff | Low        | Revert to `--fail-on error` if noisy — trivially a one-word change |

## Rollback Plan

`git checkout -- Makefile` restores the original single target. No other files affected.

## Dependencies

None.

## Success Criteria

- [ ] `make doctor` exits 0 and shows verbose output for all rules
- [ ] `make doctor-diff` exits non-zero when diff has react-doctor issues
- [ ] `make doctor-diff` completes faster than `make doctor` (diff vs full scan)
