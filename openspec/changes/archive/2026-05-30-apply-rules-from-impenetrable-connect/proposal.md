# Proposal: Apply Rules from impenetrable-connect AGENTS.md

## Intent

Adopt mature conventions from impenetrable-connect's AGENTS.md that solve real problems in sonora — tooling-enforceable rules first, documented conventions second, infrastructure third.

## Scope

### In Scope

- **Phase 1 — ESLint rules**: no-console, no-magic-numbers, consistent-type-definitions (interfaces over type for objects)
- **Phase 2 — AGENTS.md conventions**: accessibility (alt/accessibilityLabel), testID standard, loading/empty state conventions, i18n formatting rules, git workflow (branch naming, PR body, no --no-verify, no --amend)
- **Phase 3 — Logger utility**: simple logger wrapper, deprecate console.log

### Out of Scope

- Component libraries (centralized Button, AppAlert, FlashList) — premature
- Backend security rules, monorepo patterns, Zod, Hono testing — not applicable
- GPG signing, store mocks, toggle safety — no user/org mandate
- Refactoring existing `type` → `interface` — convention only, no migration

## Capabilities

None. Pure configuration and convention change — no spec-level behavior is modified.

## Approach

**Phase 1** (tooling, immediate): Add 3 ESLint rules to `eslint.config.js` — `no-console` (warn), `no-magic-numbers` (warn, with allow list for dimensions), `@typescript-eslint/consistent-type-definitions` (error). Zero code changes needed, instant enforcement.

**Phase 2** (documentation, next): Expand `AGENTS.md` with rule sections derived from impenetrable-connect: accessibility, testID, loading states, i18n formatting, git workflow, interfaces over type, no `import * as`, case-insensitive test matchers, PR merge checklist subset. All non-automatable rules go here.

**Phase 3** (infrastructure, last): Create `src/utils/logger.ts` with leveled logging (debug/info/warn/error), env-aware suppression in production, and a deprecation path for console.log. Only then can the no-console rule be enforced as error.

## Affected Areas

| Area                  | Impact   | Description                                |
| --------------------- | -------- | ------------------------------------------ |
| `eslint.config.js`    | Modified | Add 3 ESLint rules (Phase 1)               |
| `AGENTS.md`           | Modified | Expand from 3 lines to ~50 lines (Phase 2) |
| `src/utils/logger.ts` | New      | Simple leveled logger (Phase 3)            |

## Risks

| Risk                                          | Likelihood | Mitigation                                                            |
| --------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| `no-magic-numbers` noisy on RN dimensions     | High       | Use `ignoreNumbers` and `ignorePattern` for style/theme constants     |
| Overloading AGENTS.md with aspirational rules | Medium     | Only add rules that solve real problems seen in codebase              |
| Logger approach needs discussion              | Medium     | Keep it minimal — typed levels + env-suppress, no external dependency |

## Rollback Plan

- Phase 1: revert ESLint rule additions in `eslint.config.js`
- Phase 2: `git revert` AGENTS.md changes
- Phase 3: delete `src/utils/logger.ts`, revert no-console to off

## Dependencies

- Bun (existing package manager) — no new deps

## Success Criteria

- [ ] `make lint` passes with new ESLint rules active
- [ ] AGENTS.md documents all Phase 2 rules with examples
- [ ] Logger utility exists at `src/utils/logger.ts` with tests
