# Implementation Tasks: Play Core Startup Update Check

- [x] Expose `checkForUpdate()` on `UpdateService` (`apps/mobile/src/services/update-service.ts`) iterating through providers.
- [x] Ensure `PlayCoreUpdateProvider` interface and stubs in `play-core-provider.ts` and `play-core-provider.native.ts` conform to `checkForUpdate(): Promise<boolean>`.
- [x] Add `source` parameter or dedicated event to `AnalyticsService` / `analytics-events.ts` for startup update checks (`source: 'startup'`).
- [x] Connect `updateService.checkForUpdate()` to `RootLayout` (`apps/mobile/src/app/_layout.tsx`) on startup and trigger flexible update / banner state.
- [x] Update and expand unit tests in `apps/mobile/src/services/__tests__/update-service.test.ts`.
- [x] Run test suite (`bun test` / `make mobile-test`) and `make validate` to guarantee zero regressions.
