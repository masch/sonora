# AGENTS.md Conventions — Delta Specification

## ADDED Requirements

### Requirement: accessibility labels

AGENTS.md MUST document that all pressable and interactive elements MUST have an `accessibilityLabel` prop. All `Image` components MUST have an `alt` prop. Exceptions MAY exist for decorative-only images (where `alt=""` is acceptable).

#### Scenario: new Pressable follows convention

- GIVEN a developer creates a new `Pressable` component
- WHEN consulting AGENTS.md for accessibility rules
- THEN they add `accessibilityLabel="Close modal"` to the element
- AND lint passes without accessibility-related warnings

#### Scenario: decorative image with empty alt

- GIVEN an `Image` used as a decorative background
- WHEN the developer sets `alt=""`
- THEN this conforms to the documented convention

### Requirement: testID convention

AGENTS.md MUST document that every interactive component (Pressable, TouchableOpacity, Button, TextInput) MUST include a `testID` prop with a descriptive, kebab-case value matching the component's role.

#### Scenario: interactive component includes testID

- GIVEN a developer creates a "Submit" button
- WHEN following AGENTS.md conventions
- THEN they add `testID="submit-button"`
- AND tests can target it via `getByTestId("submit-button")`

### Requirement: loading/error/empty states

AGENTS.md MUST document that any view rendering async data MUST handle three states: loading (spinner or skeleton), error (message with retry option), and empty (informational message for zero results). At minimum, a loading indicator and error display are required.

#### Scenario: async screen covers all states

- GIVEN a screen fetches a list from an API
- WHEN the request is pending → a loading indicator renders
- WHEN the request fails → an error message with retry renders
- WHEN data returns empty → an empty state message renders
- THEN all three states satisfy AGENTS.md requirements

#### Scenario: missing loading state flagged

- GIVEN a screen renders data without a loading indicator
- WHEN reviewed against AGENTS.md conventions
- THEN the omission is identified as a violation

### Requirement: i18n conventions

AGENTS.md MUST document that all user-facing strings MUST use the `useTranslation` hook from `react-i18next`. Hardcoded strings in component JSX are already enforced as errors by the `i18next/no-literal-string` ESLint rule. The AGENTS.md rule documents this enforcements and the convention for adding translations.

#### Scenario: hardcoded string violation

- GIVEN a component renders `<Text>Hello</Text>` without using `t()`
- WHEN running `make lint`
- THEN ESLint flags `i18next/no-literal-string`

### Requirement: git workflow conventions

AGENTS.md MUST document:

- Branch naming: `feat/`, `fix/`, `chore/`, `refactor/` prefixes with kebab-case description
- PR body: MUST describe what changed and why, reference related issues
- No direct push to `main` — all changes through PRs
- No `--no-verify` flag on commits
- No `--amend` on commits (use new commits instead)

#### Scenario: developer follows git rules

- GIVEN a developer starts a new feature
- WHEN creating a branch → they name it `feat/add-user-profile`
- WHEN opening a PR → they write a body describing the change and linking to the issue
- WHEN committing → they do NOT use `--no-verify` or `--amend`
- THEN all actions conform to AGENTS.md workflow
