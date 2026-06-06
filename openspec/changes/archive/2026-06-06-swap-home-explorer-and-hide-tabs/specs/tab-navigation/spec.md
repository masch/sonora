# Delta for tab-navigation

## Spec Impact Review

This change is a pure UI chrome reconfiguration. No behavioral requirements are added, modified, or removed. All capability-level behavior is preserved as-is.

### Scope of Change

| Aspect         | What Happens                                                                                            | Spec Impact                                               |
| -------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Content swap   | TripMap moves from `explore.tsx` → `index.tsx`; old Home content moves from `index.tsx` → `explore.tsx` | Zero — components are relocated, not changed              |
| Tab hiding     | `explore` and `settings` tabs hidden from tab bar via a `hidden` flag                                   | Zero — routes remain navigable, no behavioral restriction |
| Tab definition | `TabDefinition` gains optional `hidden?: boolean` field                                                 | Zero — config-only, no runtime behavior change            |

### Reviewed Specs

The following existing specs were reviewed and confirmed unaffected:

| Spec                 | Reason Unaffected                                                   |
| -------------------- | ------------------------------------------------------------------- |
| `screen-layout`      | Layout structure (`ScreenWrapper`, `ScrollScreenWrapper`) unchanged |
| `nativewind-styling` | Styling approach, CSS variables, Tailwind tokens all unchanged      |

### Confirmation

This change introduces zero new requirements and modifies zero existing requirements. The system behaves identically at the capability level — only the chrome arrangement changes.

## Requirements

### Requirement: No Behavior Change

This change MUST NOT alter the behavioral requirements specified in any existing `openspec/specs/*/spec.md` file. All existing scenarios MUST continue to pass without modification.

#### Scenario: Existing specs remain valid

- GIVEN the existing test suite for all capability specs
- WHEN this change is applied
- THEN all existing scenarios continue to pass without modification

#### Scenario: Hidden routes remain navigable

- GIVEN a user on any screen
- WHEN the user calls `router.push('/explore')` or `router.push('/settings')`
- THEN the target screen renders with full functionality
- AND the tab bar visually indicates the active route when applicable
