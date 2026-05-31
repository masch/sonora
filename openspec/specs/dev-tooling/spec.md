# Dev Tooling Specification

## Purpose

Describe the developer tooling targets available in the project's Makefile. These provide consistent interfaces for code health diagnostics and regression checking during development.

## Requirements

### Requirement: `doctor` target — full codebase audit

The system MUST provide a `make doctor` target that runs `react-doctor` with all available rules and verbose output. The target drives code health fixes and MUST reach zero findings (score 100) after a fix pass.

#### Scenario: Full scan with findings

- GIVEN react-doctor is available via `bunx`
- WHEN a developer runs `make doctor`
- THEN the system executes `bunx react-doctor@latest --verbose`
- AND output includes diagnostics for all rules across the entire codebase
- AND the exit code reflects react-doctor's built-in behavior

#### Scenario: Full scan with no violations

- GIVEN the codebase has no react-doctor violations
- WHEN a developer runs `make doctor`
- THEN the process exits 0
- AND output confirms no issues found

#### Scenario: `bunx` auto-installs react-doctor

- GIVEN react-doctor is not yet installed
- WHEN a developer runs `make doctor`
- THEN `bunx` SHOULD automatically fetch and cache react-doctor
- AND the scan proceeds as normal

#### Scenario: Score reaches 100 after code health pass

- GIVEN a code health pass has been completed that addresses all findings
- WHEN a developer runs `make doctor`
- THEN the process exits 0
- AND the score is 100 with zero findings across all rules

### Requirement: `doctor-diff` target — regression check

The system MUST provide a `make doctor-diff` target that runs `react-doctor` limited to changed files, with verbose output, and exits non-zero when diagnostics include warnings or errors.

#### Scenario: Diff without violations

- GIVEN there are uncommitted changes in the working tree
- AND those changes have no react-doctor violations
- WHEN a developer runs `make doctor-diff`
- THEN the process exits 0
- AND output is limited to changed files only

#### Scenario: Diff with violations

- GIVEN there are uncommitted changes that introduce react-doctor violations
- WHEN a developer runs `make doctor-diff`
- THEN the process exits non-zero
- AND output shows violations scoped to changed files
- AND the exit code reflects at least a warning-level failure

#### Scenario: No changes to scan

- GIVEN there are no uncommitted changes in the working tree
- WHEN a developer runs `make doctor-diff`
- THEN the process exits 0
- AND output indicates nothing to scan or no violations
