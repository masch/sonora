# Tasks: README Refresh

**Change**: `readme-refresh`
**Based on**: spec + design

## Review Workload Forecast

| Field                        | Value                    |
| ---------------------------- | ------------------------ |
| Estimated changed lines      | ~200 (1 file: README.md) |
| 400-line budget risk         | Low ✅                   |
| Chained PRs recommended      | No (single file)         |
| Decision needed before apply | No                       |

## Tasks

### Task 1: Update project structure section

Replace the flat `src/` tree with the actual monorepo directory tree showing `apps/`, `packages/`, `openspec/`, etc.

**File**: `README.md` (project structure section, ~lines 67–82)
**Lines changed**: ~20
**Evidence**: tree matches `ls -d */` at repo root

### Task 2: Update validation pipeline section

Rewrite to reflect actual `.githooks/pre-commit` order: format-check → test-ci → lint → typecheck → doctor-ci → expo-doctor → gga

**File**: `README.md` (validation pipeline section, ~lines 56–65)
**Lines changed**: ~15
**Evidence**: steps match hook script

### Task 3: Fix API paths throughout

Replace all `api/` references with `apps/api/` across the whole README (commands, directory references, etc.)

**File**: `README.md` (API section, ~lines 93–166, and any other references)
**Lines changed**: ~10
**Evidence**: no remaining `api/` bare references (exclude URLs)

### Task 4: Update Makefile targets table

Add all missing targets (~80+) to the Makefile targets table. Document that the table is generated from `make help`.

**File**: `README.md` (Makefile targets table section, ~lines 34–55)
**Lines changed**: ~80
**Evidence**: every target in `make help` output appears in table

### Task 5: Final proofread & verify

Read the full updated README to verify consistency, correct markdown, and no broken references.

**File**: `README.md`
**Lines changed**: 0
**Evidence**: no markdown lint errors, all sections read coherently
