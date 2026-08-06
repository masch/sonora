# Proposal: Mobile Web Bottom Navigation Tabs

## Executive Summary

Reposition the web navigation tab bar from the top of the viewport to the bottom in `@sonora/mobile` web builds, establishing UI parity with native iOS and Android tab navigation layout.

## Problem Statement

On web viewports, the tab list was rendered at the default top absolute position. On native mobile devices, tabs are anchored at the bottom. This visual disparity made the mobile web experience feel inconsistent with the native app. Additionally, the footer version text (`AppVersionText`) interfered with the bottom navigation area.

## Proposed Solution

1. Anchor `CustomTabList` at `bottom-0 z-50` using NativeWind Tailwind positioning in `apps/mobile/src/components/app-tabs/custom-tab-list.tsx`.
2. Remove the obsolete `AppVersionText` component and its usage in `apps/mobile/src/app/(tabs)/index.tsx` to eliminate visual overlap and reduce dead code.
3. Update unit tests in `apps/mobile/src/__tests__/app-tabs.web.test.tsx` to verify bottom tab positioning and component testID props.

## Impact Analysis

- **Native App**: Zero impact (native app consumes `app-tabs.tsx` via `NativeTabs`).
- **Web App**: Floating bottom navigation bar aligned with native design system.
- **Dead Code Elimination**: Removed `AppVersionText` component and redundant assertions.
