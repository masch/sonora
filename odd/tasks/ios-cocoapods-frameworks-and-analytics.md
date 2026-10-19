# Feature: iOS CocoaPods Static Frameworks & Analytics Abstraction

**Feature ID:** `ios-cocoapods-frameworks-and-analytics`  
**Branch:** `fix/ios-cocoapods-frameworks-and-analytics`  
**Strategy:** `ask-on-risk`

## Objective

1. Resolve the iOS CI CocoaPods failure during `pod install` caused by modern Swift Firebase pods (`FirebaseSessions`) requiring module maps when linking against static libraries.
2. Formally decouple the analytics architecture by defining a shared `AnalyticsTracker` contract interface across platform implementations (`.native.ts` and `.web.ts`), ensuring future analytics providers (e.g., Sentry, PostHog) can be swapped seamlessly without altering call sites.

## Architectural Decision & Constraints

- **CocoaPods Static Frameworks**: Enable `useFrameworks: 'static'` under `expo-build-properties` for iOS in `apps/mobile/app.config.ts`. This allows CocoaPods to generate the necessary module maps for Swift pods while maintaining compatibility with native React Native modules.
- **Port & Adapter (DIP)**: Introduce `AnalyticsTracker` interface in `apps/mobile/src/services/analytics.types.ts`. Both native (`analytics.ts`) and web (`analytics.web.ts`) implementations implement this contract, providing strict typing and testability.

## Tasks

- [x] **Task 1: Enable iOS Static Frameworks in Expo Build Properties**
  - Path: `apps/mobile/app.config.ts`
  - Action: Add `ios: { useFrameworks: 'static' }` to `expo-build-properties` plugin configuration.
  - Proof: `bunx expo config --type public` validates successfully.

- [x] **Task 2: Define `AnalyticsTracker` Interface Contract**
  - Path: `apps/mobile/src/services/analytics.types.ts`
  - Action: Define strongly-typed contract for event tracking, error recording, and global rejection handling.
  - Proof: Typecheck passes with zero errors.

- [x] **Task 3: Implement Contract in Platform Adapters**
  - Path: `apps/mobile/src/services/analytics.ts`, `apps/mobile/src/services/analytics.web.ts`
  - Action: Type `AnalyticsService` with `AnalyticsTracker` in both platform files.
  - Proof: `tsc --noEmit` passes.

- [x] **Task 4: Unit & Contract Tests**
  - Path: `apps/mobile/src/services/__tests__/analytics.test.ts`
  - Action: Add assertion verifying cross-platform conformance to `AnalyticsTracker`.
  - Proof: Jest test suite passes (6/6 tests passing).
