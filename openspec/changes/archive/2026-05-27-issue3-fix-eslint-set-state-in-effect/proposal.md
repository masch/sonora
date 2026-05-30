# Proposal: Fix ESLint Error in use-color-scheme.web.ts

## Intent

`make validate` fails at lint due to `react-hooks/set-state-in-effect` in `src/hooks/use-color-scheme.web.ts:11`. This blocks the strict TDD gate (`.engram/config.json` `test_command: make validate`). Fix the lint error so the CI pipeline is reliable.

## Scope

### In Scope

- Replace `useState` + `useEffect` hydration guard with `useSyncExternalStore`
- Preserve existing behavior: SSR→`'light'`, pre-hydration→`'light'`, post-hydration→actual scheme

### Out of Scope

- No changes to consumers (`use-theme.ts`, `app-tabs.web.tsx`, etc.)
- No behavior or API changes to the hook
- No changes to the native `use-color-scheme.ts` (no lint error there)

## Capabilities

**New**: None — pure refactor, no new behavior.
**Modified**: None — no spec-level changes to existing capabilities.

## Approach

Replace the `useState`/`useEffect` pattern with `useSyncExternalStore` (React 18+ built-in). The subscribe function is a no-op (color scheme changes are already handled by RN's `Appearance` API). The client snapshot returns `true`, server snapshot returns `false`. The hook returns `'light'` until hydrated, then the real color scheme.

~14 lines changed in 1 file, zero new dependencies.

## Affected Areas

| Area                                | Impact   | Description                                                |
| ----------------------------------- | -------- | ---------------------------------------------------------- |
| `src/hooks/use-color-scheme.web.ts` | Modified | Replace `useState`/`useEffect` with `useSyncExternalStore` |

## Risks

| Risk                            | Likelihood | Mitigation                                                                                   |
| ------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| Hydration mismatch on dark mode | Low        | `useSyncExternalStore` server snapshot returns `false` → `'light'`, same as current behavior |
| Runtime behavior change         | Low        | Exact same return values in all states — validated by existing tests                         |

## Rollback Plan

Revert the single commit. No schema, migration, or consumer changes — pure revert.

## Dependencies

None.

## Success Criteria

- [ ] `make validate` passes cleanly (lint + typecheck + tests)
- [ ] Pre-existing `react-hooks/set-state-in-effect` error is gone
- [ ] No other lint/type errors introduced (`make lint`, `make typecheck`)
- [ ] Only the target file was changed (`src/hooks/use-color-scheme.web.ts`)
