# Implementation Tasks: Safe Background Task Registration and Lifecycle

- [x] Update `useRegisterBackgroundTask` (`apps/mobile/src/hooks/use-register-background-task.ts`) with default `stopOnTerminate: true` and `startOnBoot: false`, and clean up legacy registered tasks before registering.
- [x] Explicitly pass `stopOnTerminate: true` and `startOnBoot: false` in `useBackgroundSync` (`apps/mobile/src/hooks/use-background-sync.ts`).
- [x] Update unit tests in `apps/mobile/src/hooks/__tests__/use-register-background-task.test.ts` to assert safe defaults and legacy cleanup.
- [x] Update unit tests in `apps/mobile/src/hooks/__tests__/use-background-sync.test.ts` to verify safe options are propagated.
- [x] Run test suite (`bun --filter @sonora/mobile test`) and `make validate` to guarantee zero regressions.
