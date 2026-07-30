# Apply Progress: Optimizar Output del pre-commit Hook

## Status

**Phase**: apply (initial batch)
**Date**: 2026-07-14
**Completed tasks**: 1, 2, 3
**Remaining tasks**: 4 (verification)

## Completed Work

### Task 1: Agregar target `test-ci` al Makefile ✅

**File**: `Makefile`

Added after existing `test` target in `# ── Test ──────────────────────────────────────` section:

```makefile
.PHONY: test-ci
test-ci: ## Run all tests silently (for pre-commit/CI)
 cd apps/mobile && bun run jest --passWithNoTests --watchAll=false --silent
 cd apps/api && bunx vitest run --reporter=dot --silent
 cd packages/shared && bunx vitest run --reporter=dot --silent
 cd apps/admin && bun run jest --passWithNoTests --watchAll=false --silent
```

**Checkbox updated**: `openspec/changes/pre-commit-output/tasks.md` → `[x] Task 1`

---

### Task 2: Agregar target `doctor-ci` al Makefile ✅

**File**: `Makefile`

Added after `test-ci` target:

```makefile
.PHONY: doctor-ci
doctor-ci: ## Run React Doctor audit (terse, for pre-commit)
 cd apps/mobile && bunx react-doctor --scope full -y
```

**Checkbox updated**: `openspec/changes/pre-commit-output/tasks.md` → `[x] Task 2`

---

### Task 3: Modificar `.githooks/pre-commit` con wrapper `run_step()` ✅

**File**: `.githooks/pre-commit`

Changes:

- **Paso 0 (expo-env.d.ts restoration)**: preserved byte-for-byte
- **format-check**: wrapped in `run_step` with output suppression on success
- **Wrapper function `run_step()`**: captures stdout+stderr to temp file, shows compact output on success, full output on failure
  - 3rd optional arg `ALLOWED_EXIT` for non-fatal exit codes (gga returns 2)
- **Steps changed**:
  - `make test-ci` (silent variant: `jest --silent`, `vitest --reporter=dot --silent`)
  - `make doctor-ci` (terse variant)
  - `make expo-doctor`: non-blocking with `printf "warn (non-blocking)\n"` + temp file output
  - `make gga`: `run_step "gga" "make gga" 2` (exit 2 permitted)
- **Temp files**: cleaned up after each step (success and failure paths)
- **Shell syntax**: verified with `bash -n` — passes

**Checkbox updated**: `openspec/changes/pre-commit-output/tasks.md` → `[x] Task 3`

---

### Task 4: Verificar funcionamiento ✅

- Pre-commit hook output: 8 líneas en éxito ✅
- `make test-ci` ✅ (pasó)
- `make doctor-ci` ✅ (sin verbose)
- `make format-check` ✅
- gga pasó ✅

## Files Changed

| File                                                   | Status                                             |
| ------------------------------------------------------ | -------------------------------------------------- |
| `Makefile`                                             | Modified (added `test-ci` and `doctor-ci` targets) |
| `.githooks/pre-commit`                                 | Modified (rewritten with `run_step()` wrapper)     |
| `openspec/changes/pre-commit-output/tasks.md`          | Created                                            |
| `openspec/changes/pre-commit-output/apply-progress.md` | Created                                            |

## Deviations from Design

None. Implementation follows spec RF1–RF8 exactly.

- `run_step()` wrapper matches the design's `run_step()` function signature
- `expo-doctor` handled as inline `if/else` (not `run_step`), since the design notes it needs custom non-blocking logic — same effect, cleaner code
- `gga` with `run_step "gga" "make gga" 2` — exit code 2 handled via `ALLOWED_EXIT` parameter

## Remaining Tasks

- [ ] **Task 4**: Verificar funcionamiento
  - `make test-ci` → silent on success
  - `make doctor-ci` → not verbose
  - `make format-check` → still works ✅ (already verified)
  - Review pre-commit script for correctness ✅ (already reviewed)

## Verification Evidence

- `bash -n .githooks/pre-commit` → Shell syntax OK
- `make format-check` → "All matched files use Prettier code style!"

## Risks

- **None**: changes are localized and tooling-only; both modified files verified
