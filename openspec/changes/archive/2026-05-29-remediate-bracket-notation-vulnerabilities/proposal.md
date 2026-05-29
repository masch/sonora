# Proposal: Remediate Bracket Notation Vulnerabilities

## Intent

Resolve medium-severity bracket notation security findings flagged by static analysis across several Expo components and pages. By replacing dynamic index lookups with static selection logic and checking properties via `hasOwnProperty`, we prevent potential Prototype Pollution or unauthorized property access.

## Scope

### In Scope
- Refactor `explore.tsx` line 20 color scheme lookups.
- Refactor `collapsible.tsx` line 14 color scheme lookups.
- Refactor `app-tabs.tsx` line 12 color scheme lookups.
- Refactor `themed-text.tsx` lines 34-35 class maps and color maps lookups.

### Not in Scope
- Modifying test mocks (`__mocks__/react-i18next.ts`) or non-existent test files (`src/__tests__/i18n-mock.ts`) which were marked as False Positives.
- Changing component styling behaviors or visual layouts.

## Capabilities

**New**: None.
**Modified**: Security posture of theme indexing and prop rendering.

## Approach

1. **Color Scheme Ternary Substitution**:
   Replace `RuntimeColors[scheme === 'unspecified' ? 'light' : scheme]` with a static ternary selector:
   `scheme === 'dark' ? RuntimeColors.dark : RuntimeColors.light`
   This eliminates dynamic bracket indexing on `RuntimeColors` entirely.

2. **Guarded Object Lookups**:
   In `ThemedText` component, wrap dynamic lookups on `typeClassMap` and `colorClassMap` using `Object.prototype.hasOwnProperty.call()` checks. This ensures only own properties are resolved, protecting the prototype from pollution.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| src/app/explore.tsx | Modified | Replace dynamic theme lookups |
| src/components/ui/collapsible.tsx | Modified | Replace dynamic theme lookups |
| src/components/app-tabs.tsx | Modified | Replace dynamic theme lookups |
| src/components/themed-text.tsx | Modified | Add `hasOwnProperty` guards for prop mapping lookups |

## Success Criteria

- [x] All 9 test suites and 43 Jest tests pass successfully.
- [x] Compilation completes with zero errors.
- [x] Dynamic bracket notation access warnings resolved.
