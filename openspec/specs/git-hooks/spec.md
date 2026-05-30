# Git Hooks Specification

## Purpose

Define the behavior of git hooks that enforce code quality gates before commits. Currently scoped to a single pre-commit hook that runs `make validate`.

## Requirements

### R1: Pre-commit runs `make validate`

The pre-commit hook MUST execute `make validate` on every `git commit` unless the user passes `--no-verify`. The hook MUST exit with the same exit code as `make validate`.

#### Scenario: Happy path — commit passes

- GIVEN the working tree has staged changes
- WHEN the user runs `git commit`
- THEN the hook executes `make validate`
- AND if validate exits 0, the commit proceeds

#### Scenario: Validation failure blocks commit

- GIVEN the working tree has staged changes with a lint error
- WHEN the user runs `git commit`
- THEN the hook executes `make validate`
- AND the hook exits non-zero
- THEN the commit is blocked and the error output is displayed

#### Scenario: Bypass with --no-verify

- GIVEN the working tree has staged changes with known failures
- WHEN the user runs `git commit --no-verify`
- THEN the hook is skipped entirely
- AND the commit succeeds regardless of code quality

### R2: Re-stage files mutated by `format`

The hook MUST re-stage files that `prettier --write .` (the `format` step of `make validate`) modified. This ensures the commit contains formatted code.

#### Scenario: format mutates files

- GIVEN staged files that are not prettier-compliant
- WHEN the hook runs `make validate` and the `format` step writes changes
- THEN the hook runs `git add -u` after `make validate` completes
- AND the final commit includes the formatted files

### R3: Native hooksPath auto-configuration

The `package.json` MUST include a `postinstall` script that sets `core.hooksPath` to `.githooks`. This ensures the hook activates on `bun install` without manual setup.

#### Scenario: Fresh clone auto-configures hook

- GIVEN a freshly cloned repository
- WHEN the developer runs `bun install` (or `make install`)
- THEN `git config core.hooksPath .githooks` executes
- AND the next `git commit` runs the pre-commit hook automatically

### R4: Fallback `make install` target

The `Makefile` MUST include an `install` target (or modify the existing one) that runs `bun install` and explicitly configures `core.hooksPath .githooks` as a safety net for environments where lifecycle scripts are disabled.

#### Scenario: postinstall skipped via --ignore-scripts

- GIVEN a developer clones the repo and runs `bun install --ignore-scripts`
- WHEN they run `make install`
- THEN `bun install` runs (idempotent) followed by `git config core.hooksPath .githooks`
- AND the hook is configured despite the skipped lifecycle

### R5: Hook file tracked in version control

The `.githooks/pre-commit` script MUST be tracked by git. The `.githooks/` directory MUST NOT appear in `.gitignore`.

#### Scenario: Hook survives clone

- GIVEN `.githooks/pre-commit` is committed to the repository
- WHEN a developer clones the repo
- THEN `.githooks/pre-commit` exists in their working tree

### R6: Platform support

The hook MUST work on Linux and macOS. Windows is not a supported target.

#### Scenario: Hook runs on macOS

- GIVEN a macOS development machine
- WHEN the developer runs `git commit`
- THEN the hook runs via `/usr/bin/env bash` successfully
