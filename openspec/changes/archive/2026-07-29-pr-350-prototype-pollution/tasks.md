# Tasks: Hardening `setNested` against Prototype Pollution

- [x] Harden `setNested` in `apps/api/src/scripts/sync-helpers.ts` against `__proto__`, `constructor`, `prototype`, and empty key segments.
- [x] Add automated unit tests covering prototype pollution scenarios in `apps/api/src/scripts/__tests__/sync-helpers.test.ts`.
- [x] Verify test suite execution with `bun test`.
