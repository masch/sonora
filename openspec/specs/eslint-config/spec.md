# ESLint Configuration — Delta Specification

## ADDED Requirements

### Requirement: no-console rule

The ESLint config MUST add `no-console` at warning level. The rule MUST allow `logger.*` calls via allow list once Phase 3 (logger utility) exists.

#### Scenario: ESLint catches console.log

- GIVEN a source file contains `console.log(...)`
- WHEN running `make lint`
- THEN ESLint emits a warning for `no-console`

#### Scenario: logger calls are allowed

- GIVEN the logger utility exists (`src/utils/logger.ts`)
- WHEN a source file contains `logger.info(...)` or `logger.warn(...)`
- THEN ESLint emits no warning for that call

### Requirement: consistent-type-definitions

The ESLint config MUST add `@typescript-eslint/consistent-type-definitions` at error level, enforcing `interface` over `type` for object shapes. Type aliases for unions, intersections, or primitive types remain permitted.

#### Scenario: type alias for object flagged

- GIVEN a source file defines `type Foo = { bar: string }`
- WHEN running `make lint`
- THEN ESLint emits an error suggesting `interface Foo` instead

#### Scenario: type alias for union allowed

- GIVEN a source file defines `type Status = 'active' | 'inactive'`
- WHEN running `make lint`
- THEN ESLint does NOT flag this (union types are not object shapes)

### Requirement: no-magic-numbers with safe defaults

The ESLint config SHOULD add `no-magic-numbers` at warning level. It MUST configure `ignore` for common values (`0`, `1`, `2`, `16`) and `ignorePattern` for style/theme property names. If configurable exceptions are insufficient to prevent noise from React Native dimension/style patterns, this rule MAY be omitted entirely.

#### Scenario: common RN values pass lint

- GIVEN a StyleSheet definition contains `padding: 16`
- WHEN running `make lint`
- THEN no warning is emitted (16 is in the ignore list)

#### Scenario: truly magic number flagged

- GIVEN a handler contains `if (items.length > 7)` where 7 has no semantic meaning
- WHEN running `make lint`
- THEN a warning is emitted for the magic number 7

### Requirement: pre-commit enforcement

All ESLint rules MUST pass in the pre-commit lint step. The existing `make validate` pipeline (format → test → lint → typecheck → gga) MUST NOT be bypassed.

#### Scenario: lint failure blocks commit

- GIVEN a file introduces a `no-console` violation
- WHEN the developer runs `git commit`
- THEN the pre-commit hook fails before creating the commit
