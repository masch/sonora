# setNested Specification

## Purpose

`setNested` deep-sets a value into a nested object from a dot-notation key (e.g., `"common.learnMore"`), used by the sync-translations pipeline to merge database overrides into locale files. It MUST resist prototype pollution through structural implementation choices (null-prototype intermediates, recursion instead of loop-variable reassignment) and a defense-in-depth denylist.

## Requirements

### Requirement 1: Preserve Valid Nesting Functionality

`setNested` MUST correctly parse and set valid dot-notation nested properties, preserving existing siblings at every level.

#### Scenario 1.1: Simple single-level set

- GIVEN an empty object `{}`
- WHEN `setNested(obj, 'key', 'value')` is called
- THEN `obj` MUST equal `{ key: 'value' }`

#### Scenario 1.2: Deep 3-level nesting

- GIVEN an empty object `{}`
- WHEN `setNested(obj, 'a.b.c', 'deep')` is called
- THEN `obj` MUST equal `{ a: { b: { c: 'deep' } } }`

#### Scenario 1.3: Deep 4-level nesting

- GIVEN an empty object `{}`
- WHEN `setNested(obj, 'a.b.c.d', 'deep')` is called
- THEN `obj` MUST equal `{ a: { b: { c: { d: 'deep' } } } }`

#### Scenario 1.4: Overwrites existing value

- GIVEN `obj = { common: { learnMore: 'Old' } }`
- WHEN `setNested(obj, 'common.learnMore', 'New')` is called
- THEN `obj` MUST equal `{ common: { learnMore: 'New' } }`

#### Scenario 1.5: Preserves existing siblings when setting a new key

- GIVEN `obj = { common: { learnMore: 'Learn' } }`
- WHEN `setNested(obj, 'common.dismiss', 'Dismiss')` is called
- THEN `obj` MUST equal `{ common: { learnMore: 'Learn', dismiss: 'Dismiss' } }`

#### Scenario 1.6: Preserves existing siblings when inserting an intermediate level

- GIVEN `obj = { a: { b: 'existing' } }`
- WHEN `setNested(obj, 'a.c', 'new')` is called
- THEN `obj` MUST equal `{ a: { b: 'existing', c: 'new' } }`

### Requirement 2: Reject Prototype-Polluting Keys

`setNested` MUST reject any dot-notation key where any path segment matches `__proto__`, `constructor`, or `prototype`, regardless of implementation approach.

#### Scenario 2.1: Direct `__proto__` segment

- GIVEN an empty object `{}`
- WHEN `setNested(obj, '__proto__.polluted', 'yes')` is called
- THEN `obj` MUST be empty (`{}`)
- AND `({} as Record<string, unknown>).polluted` MUST be undefined
- AND `Object.prototype.polluted` MUST be undefined

#### Scenario 2.2: `constructor` then `prototype` chain

- GIVEN an empty object `{}`
- WHEN `setNested(obj, 'constructor.prototype.polluted', 'yes')` is called
- THEN `obj` MUST be empty (`{}`)
- AND `({} as Record<string, unknown>).polluted` MUST be undefined

#### Scenario 2.3: Direct `prototype` segment

- GIVEN an empty object `{}`
- WHEN `setNested(obj, 'prototype.polluted', 'yes')` is called
- THEN `obj` MUST be empty (`{}`)
- AND `({} as Record<string, unknown>).polluted` MUST be undefined

#### Scenario 2.4: Blocked key as first segment in a chain

- GIVEN an empty object `{}`
- WHEN `setNested(obj, '__proto__.a.b.c', 'value')` is called
- THEN `obj` MUST be empty (`{}`)
- AND `Object.prototype.a` MUST be undefined

#### Scenario 2.5: Blocked key as middle segment

- GIVEN `obj = { a: {} }`
- WHEN `setNested(obj, 'a.__proto__.b', 'value')` is called
- THEN `obj` MUST equal `{ a: {} }` (unchanged)
- AND `Object.prototype.b` MUST be undefined

### Requirement 3: Reject Empty Key Segments

`setNested` MUST gracefully exit without mutating `obj` if the key string is empty or contains empty segments.

#### Scenario 3.1: Double-dot produces empty segment

- GIVEN an empty object `{}`
- WHEN `setNested(obj, 'common..dismiss', 'value')` is called
- THEN `obj` MUST be empty (`{}`)

#### Scenario 3.2: Empty key string

- GIVEN an empty object `{}`
- WHEN `setNested(obj, '', 'value')` is called
- THEN `obj` MUST be empty (`{}`)

#### Scenario 3.3: Trailing dot produces empty segment

- GIVEN an empty object `{}`
- WHEN `setNested(obj, 'a.b.', 'value')` is called
- THEN `obj` MUST be empty (`{}`)

#### Scenario 3.4: Leading dot produces empty segment

- GIVEN an empty object `{}`
- WHEN `setNested(obj, '.a.b', 'value')` is called
- THEN `obj` MUST be empty (`{}`)

### Requirement 4: Use Null-Prototype Intermediates

All intermediate objects created during `setNested` traversal MUST have a `null` prototype (via `Object.create(null)`), ensuring prototype pollution resistance at the object-structure level regardless of key content.

#### Scenario 4.1: Intermediates have null prototype

- GIVEN an empty object `{}`
- WHEN `setNested(obj, 'a.b.c', 'deep')` is called
- THEN `obj` MUST equal `{ a: { b: { c: 'deep' } } }`
- AND `Object.getPrototypeOf(obj.a)` MUST be `null`
- AND `Object.getPrototypeOf(obj.a.b)` MUST be `null`

#### Scenario 4.2: Intermediate not overwritten when key already exists

- GIVEN `obj = { existing: {} }`
- WHEN `setNested(obj, 'existing.child', 'value')` is called
- THEN `obj.existing.child` MUST equal `'value'`
- AND the prototype of `obj.existing` MUST be whatever it was before the call (not forced to null)

#### Scenario 4.3: Non-null-prototype leaf values are preserved

- GIVEN a pre-existing `obj` with a regular object as an intermediate
- WHEN `setNested` traverses through it
- THEN the existing object MUST NOT have its prototype changed to null
- AND `Object.getPrototypeOf(obj.existing)` MUST be `Object.prototype` (unchanged)

#### Scenario 4.4: Null-prototype intermediates do not break sibling reads

- GIVEN `obj = { a: {} }` (regular object)
- WHEN `setNested(obj, 'a.b.c', 'value')` is called
- THEN `obj` MUST equal `{ a: { b: { c: 'value' } } }`
- AND the intermediate `obj.a.b` MUST have a null prototype
- AND `obj.a` MUST retain its original prototype

### Requirement 5: Structurally Eliminate Loop-Variable Reassignment

The implementation MUST NOT use `current = current[part]` inside a loop (the pattern CodeQL detects as `js/prototype-pollution-utility`). It MAY use recursion, `reduce`, or any other non-loop-reassignment pattern.

#### Scenario 5.1: Recursion or reduce replaces loop

- WHEN the source of `setNested` is inspected
- THEN it MUST NOT contain any `for`, `while`, or `do-while` loop that reassigns an accumulator variable via dynamic property access (`current[part]`)
- AND it MUST use recursion or a functional iteration pattern for path traversal

#### Scenario 5.2: Deep nesting works under recursion

- GIVEN an empty object `{}`
- WHEN `setNested(obj, 'w.x.y.z', 'deep')` is called
- THEN `obj` MUST equal `{ w: { x: { y: { z: 'deep' } } } }`

#### Scenario 5.3: Recursion depth of 10+ levels works

- GIVEN an empty object `{}`
- WHEN `setNested(obj, 'a.b.c.d.e.f.g.h.i.j', 'deep')` is called
- THEN `obj.a.b.c.d.e.f.g.h.i.j` MUST equal `'deep'`

### Requirement 6: Defense-in-Depth Denylist

`setNested` MUST retain the runtime denylist check for `__proto__`, `constructor`, and `prototype` key segments as a defense-in-depth measure.

#### Scenario 6.1: Denylist check exists

- WHEN the source of `setNested` is inspected
- THEN it MUST check every path segment against a denylist containing `__proto__`, `constructor`, and `prototype` before performing any traversal

#### Scenario 6.2: Denylist fires even without null-prototype bypass check

- GIVEN an implementation where null-prototype intermediates would naturally prevent pollution via `__proto__`
- WHEN a test calls `setNested(obj, '__proto__.polluted', 'yes')`
- THEN `obj` MUST be empty (`{}`) — the denylist MUST reject the call before traversal begins, regardless of null-prototype safety

#### Scenario 6.3: Denylist check uses strict equality

- GIVEN a key segment that merely CONTAINS but does not EQUAL a blocked word (e.g., `"some__proto__value"`)
- WHEN `setNested(obj, 'a.some__proto__value.b', 'value')` is called
- THEN the call MUST proceed (not rejected) because the segment does not exactly match any blocked key

#### Scenario 6.4: Denylist uses Set.has for O(1) lookup

- WHEN the source of `setNested` is inspected
- THEN the denylist MUST be implemented as a `Set` (or equivalent constant-time lookup structure) rather than an array

### Requirement 7: Existing API Contract Preserved

`setNested` MUST retain its existing function signature and side-effect semantics so callers in `sync-helpers.ts` (and the sync-translations pipeline) are not affected.

#### Scenario 7.1: Signature unchanged

- WHEN the source of `setNested` is inspected
- THEN the function signature MUST be:

  ```typescript
  export function setNested(obj: Record<string, unknown>, key: string, value: string): void;
  ```

#### Scenario 7.2: Value is always a string

- WHEN `setNested(obj, 'a.b', 'text')` is called
- THEN `obj.a.b` MUST be a `string`, not an object or array

#### Scenario 7.3: Function has void return type

- WHEN `setNested` is called with any valid arguments
- THEN the return value MUST be `undefined`

### Requirement 8: TypeScript Compilation

The refactored code MUST compile without TypeScript errors.

#### Scenario 8.1: No type errors

- WHEN `tsc --noEmit` (or the project's type-check command) is run on `apps/api/src/scripts/sync-helpers.ts`
- THEN it MUST exit with code 0 and no errors

#### Scenario 8.2: Strict null checks pass

- WHEN TypeScript is run with `strict: true` (or the project's `strictNullChecks` setting)
- THEN no type errors related to `setNested` or its use of `Object.create(null)` MUST be reported

#### Scenario 8.3: Existing callers compile

- WHEN TypeScript compiles the entire sync-translations pipeline entry point
- THEN there MUST be zero compilation errors in files that import or call `setNested`

### Requirement 9: All Existing Tests Pass

The refactored implementation MUST pass all 27 existing tests in `apps/api/src/scripts/__tests__/sync-helpers.test.ts`.

#### Scenario 9.1: Full test suite passes

- WHEN `bun test apps/api/src/scripts/__tests__/sync-helpers.test.ts` is run
- THEN all 27 tests MUST pass (exit code 0, no failures, no skipped tests)

#### Scenario 9.2: setNested-specific tests pass

- WHEN the `setNested` `describe` block is run in isolation
- THEN all tests within that block MUST pass, including prototype-pollution tests, nesting tests, sibling-preservation tests, and empty-segment tests
