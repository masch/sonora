# Feature: Configurable Instagram Link on Home Screen

**Feature ID:** `home-instagram-link`  
**Branch:** `feat/home-instagram-link`  
**Strategy:** `ask-on-risk`

## Objective

Display a centered, accessible link to the official Sonora Instagram account at the bottom of the Home screen, configured dynamically via `RemoteConfig` with fallback to `@sonora.derivapoetica`, without hardcoding the value in the UI component.

## Constraints & Conventions

- `RemoteConfigPayloadSchema` in `@sonora/shared` defines the config shape.
- `DEFAULT_REMOTE_CONFIG` provides in-bundle fallback for offline resilience.
- User-facing copy goes through `useAppTranslation` (no hardcoded strings).
- Interactive element uses `TwPressable` with `testID="home-instagram-link"` and descriptive `accessibilityLabel`.
- Deep link attempt via `Linking.openURL('instagram://user?username=...')` with fallback to `https://instagram.com/...`.
- Strict TDD (Red -> Green -> Refactor) and `make validate` verification.

## Tasks

- [x] **Task 1: Shared Remote Config Schema & Fallback**
  - Path: `packages/shared/src/schemas/config.ts`, `packages/shared/src/__tests__/config.test.ts`
  - Action: Add `social` schema with `instagramHandle` (default in `DEFAULT_REMOTE_CONFIG`).
  - Proof: `bun test packages/shared` passes (190 tests).

- [x] **Task 2: i18n Strings in Shared Locales**
  - Path: `packages/shared/src/locales/es.ts`, `packages/shared/src/locales/en.ts`
  - Action: Add `home.instagramAria` and `home.instagramHandle`.
  - Proof: Translations verified, no hardcoded strings.

- [x] **Task 3: Mobile Home Screen UI & Linking Integration**
  - Path: `apps/mobile/src/app/(tabs)/index.tsx`, `apps/mobile/src/utils/social.ts`, `apps/mobile/src/__tests__/index.test.tsx`
  - Action: Read `instagramHandle` from `useRemoteConfigStore`, render centered link at bottom, open native app on iOS/Android with fallback to web URL.
  - Proof: Jest component and utility tests pass (86 suites, 716 tests).

- [x] **Task 4: Full Validation & Quality Gate**
  - Action: Run `make validate` (linter, types, tests, GGA).
  - Proof: All checks passed. Commit `009d407`.
  - Issue: [#475](https://github.com/masch/sonora/issues/475)
  - PR: [#476](https://github.com/masch/sonora/pull/476)
