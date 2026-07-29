# Proposal: Harden `setNested` against Prototype Pollution (PR #350)

## Intent

Address security vulnerability (Code Scanning alert #2 / PR #350) in `apps/api/src/scripts/sync-helpers.ts` where un-sanitized keys passed to `setNested` can lead to prototype pollution via reserved keys like `__proto__`, `constructor`, or `prototype`.

## Scope

### In Scope

- Reject nested key segments matching `__proto__`, `constructor`, and `prototype`.
- Handle empty string segments gracefully without throwing errors.
- Unit tests covering prototype pollution scenarios for `setNested`.

### Out of Scope

- Refactoring `sync-helpers.ts` beyond `setNested`.
- Altering external contract/signature of `setNested`.

## Capabilities

### New Capabilities

None

### Modified Capabilities

None (Refactor / Security Fix)

## Approach

Inspect every key segment produced by `key.split('.')`. If any segment is empty or matches a forbidden property name (`__proto__`, `constructor`, `prototype`), exit early without mutating the target object. Add automated unit test suite verifying zero property pollution on `Object.prototype`.

## Affected Areas

| Area                                                  | Impact   | Description                                             |
| ----------------------------------------------------- | -------- | ------------------------------------------------------- |
| `apps/api/src/scripts/sync-helpers.ts`                | Modified | Add boundary checks and blocked keys set in `setNested` |
| `apps/api/src/scripts/__tests__/sync-helpers.test.ts` | New      | Test suite for `sync-helpers.ts`                        |

## Risks

| Risk                                        | Likelihood | Mitigation                                                            |
| ------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| Legitimate nested key path falsely rejected | Low        | Blocklist limited strictly to `__proto__`, `constructor`, `prototype` |

## Rollback Plan

Revert `sync-helpers.ts` to git revision prior to PR #350 branch.

## Dependencies

None

## Success Criteria

- [ ] `setNested` ignores paths containing `__proto__`, `constructor`, or `prototype`.
- [ ] No properties injected onto `Object.prototype`.
- [ ] All unit tests pass cleanly (`bun test apps/api/src/scripts/__tests__/sync-helpers.test.ts`).
