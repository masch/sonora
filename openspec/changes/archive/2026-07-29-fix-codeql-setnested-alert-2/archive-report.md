# Archive Report: Fix CodeQL `setNested` Alert #2

**Change:** `fix-codeql-setnested-alert-2`
**Archived:** 2026-07-29
**Branch:** `fix/codeql-setnested-alert-2`
**Issue:** [CodeQL Alert #2 — js/prototype-pollution-utility (medium)](https://github.com/masch/sonora/security/code-scanning/2)

## Status

**PASS ✅ — Change closed successfully.**

## Summary

Refactored `setNested` in `apps/api/src/scripts/sync-helpers.ts` to structurally eliminate the CodeQL `js/prototype-pollution-utility` pattern. The fix uses three complementary defenses:

1. **Structural**: Recursive `setAt(node, idx)` replaces loop-variable reassignment (`current = current[part]`), breaking CodeQL's pattern match
2. **Object-level**: `Object.create(null)` for all new intermediate objects — `__proto__` resolves as own data property instead of prototype chain access
3. **Runtime**: Defense-in-depth denylist (`Set` of `__proto__`, `constructor`, `prototype`) with O(1) lookup via `Set.has()`

## Artifacts Read

| Artifact       | Source                                                   | Status |
| -------------- | -------------------------------------------------------- | ------ |
| Proposal       | Engram `sdd/fix-codeql-setnested-alert-2/proposal`       | ✅     |
| Spec           | Engram `sdd/fix-codeql-setnested-alert-2/spec`           | ✅     |
| Design         | Engram `sdd/fix-codeql-setnested-alert-2/design`         | ✅     |
| Tasks          | Engram `sdd/fix-codeql-setnested-alert-2/tasks`          | ✅     |
| Apply Progress | Engram `sdd/fix-codeql-setnested-alert-2/apply-progress` | ✅     |
| Verify Report  | Engram `sdd/fix-codeql-setnested-alert-2/verify-report`  | ✅     |
| Source         | `apps/api/src/scripts/sync-helpers.ts`                   | ✅     |
| Tests          | `apps/api/src/scripts/__tests__/sync-helpers.test.ts`    | ✅     |

## Tasks Completion

All 6 tasks were completed and verified:

| Task                                                | Status |
| --------------------------------------------------- | ------ |
| Task 0 — RED: Write null-prototype tests            | ✅     |
| Task 0b — RED: Confirm tests fail (1 fail, 28 pass) | ✅     |
| Task 1 — GREEN: Refactor setNested implementation   | ✅     |
| Task 2 — REFACTOR: All 29 tests pass                | ✅     |
| Task 3 — TypeScript compilation (`tsc --noEmit`)    | ✅     |
| Task 4 — Structural audit (5 criteria)              | ✅     |

No unchecked implementation task boxes remained at archive time.

## Spec Requirements Fulfilled

All 9 requirements from the spec were verified as passing:

| #   | Requirement                                       | Result                        |
| --- | ------------------------------------------------- | ----------------------------- |
| 1   | Preserve Valid Nesting Functionality              | ✅ 6 scenarios pass           |
| 2   | Reject Prototype-Polluting Keys                   | ✅ 5 scenarios pass           |
| 3   | Reject Empty Key Segments                         | ✅ 4 scenarios pass           |
| 4   | Use Null-Prototype Intermediates                  | ✅ 4 scenarios pass           |
| 5   | Structurally Eliminate Loop-Variable Reassignment | ✅ 3 scenarios pass           |
| 6   | Defense-in-Depth Denylist                         | ✅ 4 scenarios pass           |
| 7   | Existing API Contract Preserved                   | ✅ 3 scenarios pass           |
| 8   | TypeScript Compilation                            | ✅ 3 scenarios pass           |
| 9   | All Existing Tests Pass                           | ✅ 2 scenarios pass (29 PASS) |

## Test Results

- **29 PASS, 0 fail, 0 skipped**
- **58 `expect()` calls executed**
- All existing tests unchanged, 2 new null-prototype tests added

## Domains Synced

None — this change used Engram-backed artifacts. The spec (`setNested` domain) was not synced to canonical `openspec/specs/setNested/` (no prior canonical domain exists).

## Files Changed

| File                                                  | Change                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/api/src/scripts/sync-helpers.ts`                | Replaced loop-based `setNested` with recursive `setAt(node, idx)` design (~50 changed lines)         |
| `apps/api/src/scripts/__tests__/sync-helpers.test.ts` | Added 2 new tests: null-prototype intermediates, pre-existing proto preservation (~35 changed lines) |

## Key Design Decisions

- **Recursion over loop**: Each recursive frame receives `node` as parameter — no variable rebinding. CodeQL tracks `current = current[part]` as loop-carried dependency on dynamic property access.
- **`Object.create(null)`**: Only for NEW intermediate objects. Pre-existing segments (e.g., `common` from locale objects) retain their original prototype.
- **`Object.hasOwn()`**: Own-property check only, never consults prototype chain.
- **Denylist first**: Runs before any allocation or traversal, belt-and-suspenders approach.

## Structural Audit Results

- Zero `for`, `while`, or `do-while` loops in `setNested` body ✅
- Zero occurrences of `current = current[part]` pattern ✅
- `Object.hasOwn()` replaces `part in node` ✅
- Denylist (Set) with `__proto__`, `constructor`, `prototype` intact ✅
- Empty-segment guard intact ✅
- Function signature unchanged ✅

## Archived Path

`openspec/changes/fix-codeql-setnested-alert-2/` → `openspec/archived/fix-codeql-setnested-alert-2/`

## Memory Observation IDs

| Artifact       | Engram Observation ID |
| -------------- | --------------------- |
| Proposal       | 106                   |
| Spec           | 107                   |
| Design         | 108                   |
| Tasks          | 109                   |
| Apply Progress | 110                   |
| Verify Report  | 111                   |

## Final State

Change `fix-codeql-setnested-alert-2` is **closed**. All artifacts preserved in `openspec/archived/fix-codeql-setnested-alert-2/` and Engram topic keys under `sdd/fix-codeql-setnested-alert-2/*`.
