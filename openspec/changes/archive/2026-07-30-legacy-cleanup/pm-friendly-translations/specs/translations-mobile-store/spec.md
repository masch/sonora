# Translations Mobile Store Specification

## Purpose

Deliver remote translation overrides to the mobile app using the same fetch-cache-merge pattern as `remote-config-store`, with built-in `.ts` files as the guaranteed offline fallback.

## Requirements

### Requirement: Translation Zustand Store

The system MUST create a `useTranslationStore` in `apps/mobile/src/store/translation-store.ts` with interface mirroring `remote-config-store`. The store MUST expose `translations` (`Record<string, Record<string, string>>` keyed by language), `isLoading`, `error`, and an `init()` method.

#### Scenario: Store initialises cleanly

- GIVEN the app launches
- WHEN `useTranslationStore` is created
- THEN `translations` is `{}`, `isLoading` is `true`, `error` is `null`

### Requirement: Non-blocking Init

The `init()` method MUST return immediately and perform the network fetch asynchronously. The app MUST render with built-in `.ts` translations before the fetch completes. When the store resolves, i18next resources MUST update reactively so the UI re-renders with overlaid values.

#### Scenario: App renders before fetch resolves

- GIVEN the app starts on a slow network
- WHEN `init()` is called and the fetch hangs
- THEN the UI renders immediately from `.ts` files; the store does not block or show an error

### Requirement: Fetch → Cache → Merge Pipeline

The store MUST fetch `GET /api/translations/:lang` for each registered language, validate entries against `TranslationEntrySchema`, cache the validated payload to SQLite, then merge into i18next resources. Merge precedence (high to low): remote DB > SQLite cache > built-in `.ts`.

#### Scenario: Remote value overlays default

- GIVEN `en.ts` has `explore.title = "Explore"`
- WHEN the API returns `{ "explore.title": "Discover" }` for `en`
- THEN after the fetch resolves, `t('explore.title')` returns `"Discover"`

#### Scenario: Key absent in remote passes through

- GIVEN `.ts` has `en.settings.label = "Settings"` but the API response omits `settings.label`
- WHEN the merge completes
- THEN `t('settings.label')` returns `"Settings"` (unchanged)

#### Scenario: Invalid remote value is discarded

- GIVEN the API returns `{ "explore.title": "" }` (fails schema validation)
- WHEN the merge processes the entry
- THEN `t('explore.title')` resolves to the `.ts` default, not the empty string

### Requirement: SQLite Cache Layer

The system MUST create `apps/mobile/src/storage/translations-cache.ts` and `translations-cache.web.ts` (mobile / web platform variants) mirroring the `config-cache.ts` pattern. Each cache operation MUST be scoped by language. A corrupted cache entry MUST be silently dropped (return `null`).

#### Scenario: Cache restores overrides across restarts

- GIVEN a previous session cached `{ "explore.title": "Discover" }` for `en`
- WHEN the app launches offline and no API response is available
- THEN `getCachedTranslations('en')` returns the cached value before the fetch attempt

#### Scenario: Corrupted cache is silently dropped

- GIVEN the SQLite entry contains invalid JSON
- WHEN `getCachedTranslations` is called
- THEN it returns `null` without throwing

### Requirement: Offline Fallback

When no network is available and no cache exists, the app MUST render with only built-in `.ts` translations. The store MUST NOT surface an error to the user for missing translations.

#### Scenario: Fresh install, no network, no cache

- GIVEN the user installs the app on a plane (no network)
- WHEN the app launches and `init()` runs
- THEN all strings resolve from `.ts` files; no error or warning is shown
