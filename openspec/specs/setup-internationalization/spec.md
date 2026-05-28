# Internationalization Specification

## Purpose

Externalize all user-facing strings into typed translation keys, enable locale detection via device settings, and prevent hardcoded string regressions through lint enforcement. Infrastructure-only — no new user-facing behavior.

## Requirements

### Requirement: i18n Initialization

The system MUST initialize i18next with `expo-localization` for device locale detection, `compatibilityJSON: 'v3'` for Hermes compatibility, and a fallback to `'en'`. The init module MUST be imported once at `src/app/_layout.tsx` and MUST NOT require per-screen setup.

#### Scenario: App launch with non-English locale

- GIVEN the device locale is `'es-MX'`
- WHEN `@/i18n` is imported in `_layout.tsx`
- THEN i18next resolves `'es'` as language
- AND all strings render from the `en` fallback (only locale available)

#### Scenario: Hermes compatibility

- GIVEN the app runs on Hermes (Expo SDK 56 default, no `Intl`)
- WHEN i18next initializes with `compatibilityJSON: 'v3'`
- THEN no Intl-related crashes or warnings occur

#### Scenario: Locale detection failure

- GIVEN `expo-localization.getLocales()` throws
- WHEN i18next initializes
- THEN the system falls back to `'en'` without crashing

### Requirement: Translation File Structure

Translations MUST be defined as `as const` objects in `src/i18n/locales/en.ts`. Keys MUST follow `screen.element.descriptor` convention (e.g., `explore.title`, `settings.section.preferences`). A type in `src/i18n/types.ts` MUST expose the `TranslationKeys` type derived from the translation tree.

#### Scenario: Key convention

- GIVEN keys follow `screen.element.descriptor` format
- WHEN `t('explore.title')` is called
- THEN the correct string `"Explore"` is returned

#### Scenario: Type safety violation

- GIVEN `TranslationKeys` is derived from `as const`
- WHEN a developer passes an invalid key to `t()`
- THEN TypeScript reports a compile-time error

### Requirement: Screen String Migration

All hardcoded user-facing strings in `src/app/explore.tsx`, `src/app/index.tsx`, and `src/app/settings.tsx` MUST be replaced with `t()` calls. Collapsible titles, section headers, hint-row defaults (in `src/components/hint-row.tsx`), button labels, and descriptive text are all in scope. The app MUST render identically before and after migration.

#### Scenario: Explore screen renders translated content

- GIVEN the explore screen renders
- WHEN all `<TwText>` and `<ThemedText>` children reference `t()` keys
- THEN each visible string matches the translation file value

#### Scenario: Settings section headers

- GIVEN the settings screen renders
- WHEN the "Preferences" and "About" section headers display
- THEN they resolve via `t('settings.section.preferences')` and `t('settings.section.about')`

#### Scenario: Hint-row default fallback

- GIVEN `HintRow` renders without `title` or `hint` props
- WHEN the default values display
- THEN they resolve through `t('index.hintRow.title')` and `t('index.hintRow.hint')`

### Requirement: Tab Label Translation

Tab labels in `src/constants/tabs.ts` MUST be consumed via `useTranslation` in the tab component rather than read directly from the constant's `label` field.

#### Scenario: Tab labels render from translation

- GIVEN the tab navigator renders three tabs
- WHEN `t('tabs.home')`, `t('tabs.explore')`, `t('tabs.settings')` are called
- THEN each tab label matches the translation file entry

### Requirement: ESLint Enforcement

`eslint-plugin-i18next` MUST be added with `i18next/no-literal-string` enabled. The rule MUST use `markupOnly: true` to flag only JSX text content. An `allow` list MUST exempt non-user-facing strings (code paths, punctuation, platform-specific literals).

#### Scenario: Catches new hardcoded string

- GIVEN a developer adds `<TwText>Hello</TwText>`
- WHEN `make lint` runs
- THEN the linter reports an error for the un-translated literal

#### Scenario: Allow list exempts valid strings

- GIVEN a string matches an `allow` list pattern
- WHEN `make lint` runs
- THEN the linter does NOT flag it

### Requirement: Expo Config Plugin

`expo-localization` MUST be registered in `app.json` under `expo.plugins`.

#### Scenario: Plugin registered

- GIVEN `app.json` contains `expo-localization` in plugins
- WHEN the app builds for any platform
- THEN locale detection functions correctly at runtime
