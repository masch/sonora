# Tasks: Remediate Bracket Notation Vulnerabilities

**Change**: `remediate-bracket-notation-vulnerabilities`

---

## Review Workload Forecast

| Field                   | Value               |
| ----------------------- | ------------------- |
| Estimated changed lines | ~25                 |
| Largest single phase    | Phase 1 (~10 lines) |
| 400-line budget risk    | Low                 |
| Chained PRs recommended | No                  |
| Delivery strategy       | ask-on-risk         |
| Chain strategy          | size-exception      |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

**Rationale**: The changes are small and self-contained, resolving security warnings across 4 files (~25 lines in total).

---

## Phase 1: Substitutions and Guards ✅

**Scope**: Replace dynamic index lookups with static selections, and guard prop lookups in `ThemedText`.

**Files**:

- `src/app/explore.tsx`
- `src/components/ui/collapsible.tsx`
- `src/components/app-tabs.tsx`
- `src/components/themed-text.tsx`

**Changes**:

- [x] Replace dynamic color scheme lookups in `explore.tsx`, `collapsible.tsx`, and `app-tabs.tsx` with `scheme === 'dark' ? RuntimeColors.dark : RuntimeColors.light`
- [x] Guard `typeClassMap` and `colorClassMap` lookups in `themed-text.tsx` with `Object.prototype.hasOwnProperty.call()`

**Verification**:

- [x] Run `bun jest --watchAll=false` and confirm all 43 tests pass.
- [x] Verify no syntax or TypeScript compilation errors exist.
