# SDD Proposal: README Refresh

**Change**: `readme-refresh`
**Project**: Sonora
**Date**: 2026-07-16

## Problem

The README.md is significantly outdated. It describes a flat `src/` project structure that no longer exists, references wrong API paths (`api/` instead of `apps/api/`), and its validation pipeline section doesn't match what the actual pre-commit hook runs.

## Solution

Full refresh of README.md to reflect the current project state:

1. **Project structure** — replace flat `src/` layout with the actual monorepo structure (`apps/`, `packages/`, `openspec/`, `docs/`, `scripts/`)
2. **API paths** — update all references from `api/` to `apps/api/` (paths, commands, examples)
3. **Validation pipeline** — rewrite to match the actual pre-commit hook: `format-check` → `test-ci` → `lint` → `typecheck` → `doctor-ci` → `expo-doctor` (non-blocking) → `gga`
4. **Makefile targets table** — add missing targets (`test-admin`, `test-shared`, `test-ci`, `doctor-ci`, `admin-dev`, `start-wrangler`, firebase targets, etc.)
5. **GGA references** — maintain but align with current Makefile + hook reality

## Non-goals

- No functional code changes
- No restructuring of README sections (only content updates)
- No removal of any section unless demonstrably obsolete

## Success criteria

- README.md project structure matches `ls -d */` at repo root
- API section paths resolve correctly (`apps/api/` not `api/`)
- Validation pipeline section matches `.githooks/pre-commit` steps and order
- Makefile targets table is complete (all targets listed in `make help` are present)
