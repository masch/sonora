# Delta for dev-tooling

## Overview

This is a **pure code health change** — no spec-level behavioral changes. The system behaves identically before and after. The change is driven entirely by react-doctor v0.2.14 diagnostics: 19 findings across 10 files that reduce the score from 100 to 92. After the fix pass, the score returns to 100.

## MODIFIED Requirements

### Requirement: `doctor` target — full codebase audit

The system MUST provide a `make doctor` target that runs `react-doctor` with all available rules and verbose output. The target drives code health fixes and MUST reach zero findings (score 100) after the fix pass.
(Previously: No explicit score target — exit code reflected react-doctor's built-in behavior.)

#### Scenario: Full scan with findings

- GIVEN react-doctor is available via `bunx`
- WHEN a developer runs `make doctor`
- THEN the system executes `bunx react-doctor@latest --verbose`
- AND output includes diagnostics for all rules across the entire codebase
- AND the exit code reflects react-doctor's built-in behavior

#### Scenario: Full scan with no violations

- GIVEN the codebase has no react-doctor violations
- WHEN a developer runs `make doctor`
- THEN the process exits 0
- AND output confirms no issues found

#### Scenario: `bunx` auto-installs react-doctor

- GIVEN react-doctor is not yet installed
- WHEN a developer runs `make doctor`
- THEN `bunx` SHOULD automatically fetch and cache react-doctor
- AND the scan proceeds as normal

#### Scenario: Score reaches 100 after code health pass

- GIVEN the fix-react-doctor-findings change has been applied
- WHEN a developer runs `make doctor`
- THEN the process exits 0
- AND the score is 100 with zero findings across all rules

## Rule Resolution Reference

These react-doctor rules are addressed (✓ Fixed) or suppressed (⊘ Suppressed) by this change:

| Rule                                       | Resolution                                                     | Impact Group     |
| ------------------------------------------ | -------------------------------------------------------------- | ---------------- |
| `design-no-redundant-size-axes`            | ✓ Fixed — `w-* h-*` → `size-*`                                 | PR1 Mechanical   |
| `design-no-redundant-padding-axes`         | ✓ Fixed — `px-* py-*` → `p-*`                                  | PR1 Mechanical   |
| `rn-no-raw-text`                           | ✓ Fixed — wrapped raw text in `<ThemedText>`                   | PR1 Mechanical   |
| `unused-dev-dependency`                    | ✓ Fixed — removed `react-doctor` from package.json             | PR1 Mechanical   |
| `unused-export` (TabButton, CustomTabList) | ✓ Fixed — removed `export` keyword                             | PR1 Mechanical   |
| `unused-export` (4 false positives)        | ⊘ Suppressed — deslop can't resolve Expo Router / `@/` aliases | PR1 Mechanical   |
| `deslop/unused-file` (\_layout.tsx)        | ⊘ Suppressed — Expo Router auto-loads `_layout.tsx`            | PR1 Mechanical   |
| `no-z-index-9999`                          | ✓ Fixed — calculated z-index values                            | PR2 Careful      |
| `rn-no-dimensions-get`                     | ✓ Fixed — `useWindowDimensions()` replaces `Dimensions.get`    | PR2 Careful      |
| `rn-no-legacy-expo-packages`               | ✓ Fixed or ⊘ — per SDK 56 investigation                        | PR2 Careful      |
| `no-multi-comp`                            | ✓ Fixed — extracted `TabButton` + `CustomTabList`              | PR3 Architecture |
| `no-polymorphic-children`                  | ✓ Fixed — explicit `accessibilityLabel` prop                   | PR3 Architecture |
