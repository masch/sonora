# nativewind-styling Specification (Delta)

## Requirements

### Requirement: Build Infrastructure

#### Scenario: lightningcss is pinned

- GIVEN `package.json` overrides
- WHEN `bun install` completes
- THEN `lightningcss` MUST resolve to 1.30.1
