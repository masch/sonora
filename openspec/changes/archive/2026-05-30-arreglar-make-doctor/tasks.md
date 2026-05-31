# Tasks: arreglar make doctor

## Review Workload Forecast

| Field                   | Value          |
| ----------------------- | -------------- |
| Estimated changed lines | ~5             |
| 400-line budget risk    | Low            |
| Chained PRs recommended | No             |
| Suggested split         | Single PR      |
| Delivery strategy       | ask-on-risk    |
| Chain strategy          | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                    | Likely PR | Notes                      |
| ---- | ----------------------- | --------- | -------------------------- |
| 1    | Update Makefile targets | PR 1      | Single file, single commit |

## Phase 1: Implementation

- [x] 1.1 Add `--verbose` flag to `doctor` target (change `bunx react-doctor@latest` → `bunx react-doctor@latest --verbose`)
- [x] 1.2 Add `doctor-diff` to `.PHONY` declaration
- [x] 1.3 Add `doctor-diff` target: `bunx react-doctor@latest --verbose --diff --fail-on warning` with doc comment `## Run React Doctor audit on staged diff (regression check)`

## Testing Note

`strict_tdd: true` is set, but this is a pure Makefile/config change with no application code. No automated tests are possible. Verification is manual: run `make doctor` and `make doctor-diff` in terminal and observe exit codes + output per spec scenarios.

## Spec Scenarios Covered

- R1 (doctor): Full scan with findings, Full scan clean, bunx auto-install
- R2 (doctor-diff): Diff clean, Diff with violations, No changes
