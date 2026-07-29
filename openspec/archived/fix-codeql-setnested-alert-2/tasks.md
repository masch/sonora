# Tasks: Fix CodeQL `setNested` Alert #2

## Review Workload Forecast

| Field                   | Value                           |
| ----------------------- | ------------------------------- |
| Estimated changed lines | ~50–60 (15 source + 35–45 test) |
| 400-line budget risk    | Low                             |
| Chained PRs recommended | No                              |
| Suggested split         | single PR                       |
| Delivery strategy       | single-pr                       |
| Chain strategy          | size-exception                  |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low
```

## Phase Mandate

**STRICT TDD** is active. Tests MUST be written (and seen fail) BEFORE the implementation changes. See phase tasks below for the exact RED → GREEN → REFACTOR sequence.

## Task List

### Task 0 — RED: Write two new null-prototype tests (tests fail first)

**Description:** Add 2 tests to `setNested` describe block in `apps/api/src/scripts/__tests__/sync-helpers.test.ts` that verify null-prototype intermediate behavior. The current implementation uses `{}` (prototype = `Object.prototype`) for new intermediates, so these tests MUST fail on first run.

**Test 1 — Null-prototype intermediates** (covers Spec Scenario 4.1):

```typescript
it('creates null-prototype intermediate objects', () => {
  const obj: Record<string, unknown> = {};
  setNested(obj, 'a.b.c', 'deep');
  expect(obj.a).toBeDefined();
  expect(obj.a.b).toBeDefined();
  expect(Object.getPrototypeOf(obj.a)).toBeNull();
  expect(Object.getPrototypeOf(obj.a.b)).toBeNull();
});
```

**Test 2 — Existing intermediates preserve their prototype** (covers Spec Scenarios 4.3, 4.4):

```typescript
it('preserves prototype of pre-existing intermediate objects', () => {
  const existing: Record<string, unknown> = {};
  const obj = { existing };
  setNested(obj, 'existing.child', 'value');
  expect(obj.existing.child).toBe('value');
  expect(Object.getPrototypeOf(obj.existing)).toBe(Object.prototype);
});
```

**Files touched:** `apps/api/src/scripts/__tests__/sync-helpers.test.ts`
**Expected outcome:** Tests file updated. Running `cd apps/api && bun test` (or `vitest run`) shows the 2 new tests FAILING. All 27 existing tests still PASS.

**Dependencies:** None (prerequisite for Task 1).

**Ownership:** <!-- sdd-owner: implementation -->

---

### Task 0b — Verify RED tests fail

**Description:** Run the test suite to confirm the 2 new tests produce the expected failure (null prototype assertion fails because current implementation uses `{}` instead of `Object.create(null)`). Capture the terminal output as evidence.

**Command:** `cd apps/api && bun test src/scripts/__tests__/sync-helpers.test.ts` or `npx vitest run src/scripts/__tests__/sync-helpers.test.ts`

**Files touched:** None (read-only verification).
**Expected outcome:** Terminal output shows 2 failed, 27 passed. The failing test names match the 2 new tests.

**Dependencies:** Task 0 complete.
**Ownership:** <!-- sdd-owner: implementation -->

---

### Task 1 — GREEN: Refactor `setNested` implementation

**Description:** Replace the loop-based traversal in `apps/api/src/scripts/sync-helpers.ts` with the recursive design from the design spec. The key changes are:

1. **Remove the for-loop** with `current = current[part]` reassignment — CodeQL's pattern trigger.
2. **Add inner recursive function `setAt(node, idx)`** that receives `node` as a parameter (no variable rebinding).
3. **Use `Object.create(null)`** for newly created intermediate objects (null prototype).
4. **Use `Object.hasOwn(node, part)`** instead of `part in node` for own-property check — does not consult prototype chain.
5. **Keep the denylist** (`Set` of `__proto__`, `constructor`, `prototype`) at entry — same as current.
6. **Keep the empty-key early exit** — same as current.
7. **Keep the same function signature** `(obj: Record<string, unknown>, key: string, value: string): void`.

**New implementation body (conceptual):**

```typescript
const parts = key.split('.');
if (parts.length === 0 || parts.some((part) => part.length === 0)) return;

const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);
if (parts.some((part) => blockedKeys.has(part))) return;

const lastIdx = parts.length - 1;
function setAt(node: Record<string, unknown>, idx: number): void {
  if (idx === lastIdx) {
    node[parts[idx]] = value;
    return;
  }
  const part = parts[idx];
  if (
    !Object.hasOwn(node, part) ||
    typeof node[part] !== 'object' ||
    node[part] === null ||
    Array.isArray(node[part])
  ) {
    node[part] = Object.create(null) as Record<string, unknown>;
  }
  setAt(node[part] as Record<string, unknown>, idx + 1);
}
setAt(obj, 0);
```

**Exact requirements to enforce:**

- Zero `for`, `while`, or `do-while` loops in the `setNested` function body.
- Zero occurrences of `current[part]` as an l-value or r-value in a loop context.
- Every new intermediate object created by this function uses `Object.create(null)`.
- Pre-existing intermediate objects (already present in `obj` before the call) retain their original prototype.
- The denylist check runs before any object mutation.
- The function remains a named export with the identical signature.

**Files touched:** `apps/api/src/scripts/sync-helpers.ts`
**Expected outcome:** `setNested` refactored. No TypeScript errors. The recursive pattern no longer contains the loop-variable reassignment that CodeQL flags.

**Dependencies:** Task 0b (RED confirmed failing).
**Ownership:** <!-- sdd-owner: implementation -->

---

### Task 2 — REFACTOR: Run full test suite, confirm all pass

**Description:** Run the complete test suite for `apps/api/src/scripts/__tests__/sync-helpers.test.ts`. All 29 tests (27 existing + 2 new) MUST pass.

**Command:** `cd apps/api && bun test src/scripts/__tests__/sync-helpers.test.ts` or `npx vitest run src/scripts/__tests__/sync-helpers.test.ts`

**Files touched:** None (read-only verification).
**Expected outcome:** Exit code 0. Terminal output shows 29 passed, 0 failed, 0 skipped.

**Dependencies:** Task 1 (GREEN implementation complete).
**Ownership:** <!-- sdd-owner: implementation -->

---

### Task 3 — TypeScript compilation check

**Description:** Verify the project compiles without type errors after the refactor. The `Object.create(null)` return type is `any`, and `node[part]` after assignment may need a cast to `Record<string, unknown>`.

**Command:** `cd apps/api && npx tsc --noEmit` or the project's `make typecheck` equivalent.

**Files touched:** None (read-only verification).
**Expected outcome:** Exit code 0. Zero TypeScript errors.

**Dependencies:** Task 2 (all tests pass).
**Ownership:** <!-- sdd-owner: implementation -->

---

### Task 4 — Final verification and structural audit

**Description:** Perform a manual structural audit of the refactored `setNested` to confirm:

1. **No loop-variable reassignment**: grep the function body for `for`, `while`, `do` inside the `setNested` function. Must not find any.
2. **No `part in node`**: verify `Object.hasOwn()` is used instead of the `in` operator.
3. **Denylist intact**: confirm `Set` with `__proto__`, `constructor`, `prototype` exists.
4. **Empty segment check intact**: confirm the `parts.some(part => part.length === 0)` guard.
5. **Signature unchanged**: `export function setNested(obj: Record<string, unknown>, key: string, value: string): void`

**Command:** Visual inspection or `grep -n 'for\|while\|do\|in node' apps/api/src/scripts/sync-helpers.ts`

**Files touched:** None (read-only verification).
**Expected outcome:** All 5 structural criteria verified. No CodeQL-detectable pattern remains.

**Dependencies:** Task 3 (TypeScript compiles).
**Ownership:** <!-- sdd-owner: implementation -->

---

## Summary

| Task | Name                            | Type  | Files       | Verification                              |
| ---- | ------------------------------- | ----- | ----------- | ----------------------------------------- |
| 0    | RED: Write null-prototype tests | Write | test file   | 2 new tests, 27 existing PASS             |
| 0b   | RED: Confirm tests fail         | Run   | —           | 2 fail, 27 pass                           |
| 1    | GREEN: Refactor setNested       | Write | source file | No loop-reassignment, Object.create(null) |
| 2    | REFACTOR: All tests pass        | Run   | —           | 29 pass, 0 fail                           |
| 3    | TypeScript check                | Run   | —           | tsc --noEmit exit 0                       |
| 4    | Structural audit                | Run   | —           | 5 criteria met                            |

## Rollback

1. Revert `apps/api/src/scripts/sync-helpers.ts` to its committed state: `git checkout HEAD -- apps/api/src/scripts/sync-helpers.ts`
2. Revert `apps/api/src/scripts/__tests__/sync-helpers.test.ts` to its committed state: `git checkout HEAD -- apps/api/src/scripts/__tests__/sync-helpers.test.ts`
3. Run tests to confirm suite returns to 27 passing: `cd apps/api && bun test`
