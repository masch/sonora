# Logger Utility — Full Specification

## Purpose

Provide a lightweight, environment-aware logging utility that replaces direct `console.*` calls throughout the codebase. The logger enables runtime-level filtering (suppress debug/info in production) and gives the no-console ESLint rule a concrete allowed target.

## Requirements

### Requirement: logger exports four levels

The module at `src/utils/logger.ts` MUST export `debug`, `info`, `warn`, and `error` functions. Each function MUST accept a message string and optional metadata parameters, with a consistent signature matching `console.*` conventions.

#### Scenario: all methods available on import

- GIVEN the logger module is imported
- WHEN calling `logger.debug("msg")`, `logger.info("msg")`, `logger.warn("msg")`, `logger.error("msg")`
- THEN each call produces output at the correct severity level
- AND no errors or type violations occur

### Requirement: environment-aware suppression

The logger MUST suppress `debug` and `info` output when running in production (when `__DEV__` is `false`). The `warn` and `error` methods MUST always produce output regardless of environment.

#### Scenario: production suppresses debug

- GIVEN the app runs in production (`__DEV__` is false)
- WHEN `logger.debug("network request")` is called
- THEN no output is written to console

#### Scenario: error always shown

- GIVEN the app runs in production (`__DEV__` is false)
- WHEN `logger.error("API failure", err)` is called
- THEN the error message and metadata ARE written to console

### Requirement: console.log migration

All existing `console.log` calls in the codebase SHOULD be replaced with equivalent `logger.*` calls. The appropriate level mapping: `console.log` → `logger.info`, `console.debug` → `logger.debug`, `console.warn` → `logger.warn`, `console.error` → `logger.error`. After migration, `make lint` MUST pass without `no-console` warnings (excluding `logger.*` calls).

#### Scenario: migrated code passes lint

- GIVEN a file that previously contained `console.log("rendered")`
- WHEN the call is replaced with `logger.info("rendered")`
- THEN `make lint` passes without `no-console` warnings

#### Scenario: unmigrated console.log caught

- GIVEN a file still contains `console.log(...)`
- WHEN running `make lint`
- THEN ESLint emits a `no-console` warning (migration reminder)
