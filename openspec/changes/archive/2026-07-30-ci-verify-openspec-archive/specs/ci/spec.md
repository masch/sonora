# Spec: CI OpenSpec Archived Verification

## Requirements

### Requirement 1: Detect Unarchived Completed Changes

The verification script MUST inspect `openspec/changes/` for subdirectories. If a subdirectory contains a `tasks.md` where all task checkboxes are marked (`- [x]`), it MUST flag it as an error and return exit code 1.

### Requirement 2: Makefile Integration

A `verify-openspec` target MUST be added to `Makefile` so developers and CI can run the check uniformly.

### Requirement 3: PR CI Job Execution

The `.github/workflows/ci-pr.yml` workflow MUST execute `make verify-openspec` in the `format` job.
