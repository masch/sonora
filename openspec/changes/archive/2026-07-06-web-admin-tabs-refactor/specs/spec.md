# Spec: Web Admin Tabs Refactor

## Scope

Introduce tab-based navigation group `(tabs)` in the `@sonora/admin` web application, using the same pattern and library (`expo-router/ui`) as the mobile app.

## Requirements

1. **Tabs configuration**:
   - Tab 1: `index` (Translations dashboard)
   - Tab 2: `upload-audios` (Mockup audio upload screen)
2. **Tab Bar**:
   - Replicate the custom tab bar components from mobile: `AppTabs`, `TabButton`, `CustomTabList`.
   - Maintain the same visual aesthetic and support dark/light modes.
3. **Authentication Routing**:
   - Root layout directs to `/login` if not authenticated.
   - If authenticated, directs to `(tabs)/` (which resolves to `(tabs)/index`).
