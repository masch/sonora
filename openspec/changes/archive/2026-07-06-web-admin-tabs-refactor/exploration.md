# Exploration: Web Admin Tabs Refactor

## Current State Analysis

The `@sonora/admin` application is a simple Expo web application. Its file-based routing structure in `apps/admin/src/app` is currently:

- `_layout.tsx`: Renders the root stack. Handles authentication checks (redirects to `/login` if not authenticated, or `/` if already logged in).
- `index.tsx`: The main translation editor dashboard (`TranslationEditorScreen`).
- `login.tsx`: Login screen.

### Navigation and Routing

The root layout (`_layout.tsx`) uses a standard `<Stack>` navigator from `expo-router` with two main screens:

1. `index` (Title: dashboard.title)
2. `login` (Title: login.title, headerShown: false)

### Constraints and Goals

- The user wants to restructure the admin web app to use tabs like the mobile app, leaving it ready for future tabs (e.g. users management, configuration, audits, etc.).
- The current translation editor screen should become the first tab (e.g., "Translations").
- The authentication logic and overall styling conventions should remain consistent.
- Accessibility labels, test IDs, and i18n rules must be respected.

---

## Proposed Refactoring Architecture

To split the admin application into tabs, we can use the same file-based group directory structure as the mobile app:

1. Create `apps/admin/src/app/(tabs)` directory.
2. Create a layout `apps/admin/src/app/(tabs)/_layout.tsx` using `expo-router/ui` tabs or standard `expo-router` `<Tabs>`.
3. Move `apps/admin/src/app/index.tsx` to `apps/admin/src/app/(tabs)/index.tsx`.
4. Create a placeholder tab, for example `apps/admin/src/app/(tabs)/settings.tsx`, to demonstrate multi-tab navigation and ensure the structure is verified.

### Options for Tab Component Implementation

#### Option A: Reuse/adapt the `<AppTabs>` pattern from Mobile

We could share/replicate the `<AppTabs>` component using `expo-router/ui` (which is configured for web) or create a simplified local version of it inside `apps/admin/src/components/admin-tabs.tsx`.
Since admin is web-only, we can design a beautiful, responsive desktop-friendly sidebar/header-based tab switcher instead of a bottom tab bar designed for mobile phones.

#### Option B: Standard Expo Router `<Tabs>`

Use standard `Tabs` from `expo-router` with native/web styling.

### Recommended Approach

We will choose **Option A** (local customized tab bar for admin web). Since the admin panel is a web dashboard, a top or side navigation layout is much more professional and fits web standards better than a bottom tab bar.
We will structure the routes under a `(tabs)` group:

- `apps/admin/src/app/(tabs)/_layout.tsx` -> The tab layout that renders the tab bar.
- `apps/admin/src/app/(tabs)/index.tsx` -> The translation editor.
- `apps/admin/src/app/(tabs)/settings.tsx` -> A placeholder tab (e.g., settings / dashboard metadata).
- `apps/admin/src/app/_layout.tsx` -> Root Stack layout mapping to `(tabs)` and `login`.

We will also update routing/redirection checks in `apps/admin/src/app/_layout.tsx` to handle the new path structure correctly.
