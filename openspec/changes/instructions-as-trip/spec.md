# Instructions as Trip — Specification

## Overview

The hardcoded instructions audio (`instructions.mp3`) is converted into a first-class Trip experience served by the Experiences API. This establishes a single source of truth for its audio URL, makes the instructions discoverable in the Derivas (trips) section, and provides consistent trip semantics (waypoint, theme, image, download identifiers).

## Domain Breakdown

The change covers four domains, each specified below:

1. **Shared: Experiences Types & Enums** — new theme key, new image key
2. **Backend: API Seed Data & Themes** — new trip experience, new theme, locale translations
3. **Mobile: Home Audio Player** — API-driven URL resolution with fallback
4. **Mobile: Image Assets** — mapping the new image key to the existing asset

---

## 1. Shared: Experiences Types & Enums

### Requirement: TRACK_IMAGE_KEYS includes trip-instructions-cover

The system MUST include `'trip-instructions-cover'` in the `TRACK_IMAGE_KEYS` array exported from `@sonora/shared`.

#### Scenario: Image key is available in shared constants

- GIVEN the `@sonora/shared` package
- WHEN `TRACK_IMAGE_KEYS` is imported
- THEN `'trip-instructions-cover'` SHALL be present in the array

### Requirement: onboarding theme key is added to enum-like structures

The system MUST support the theme key `'onboarding'` as a valid theme identifier.

#### Scenario: Theme key can be referenced

- GIVEN the shared experiences domain
- WHEN a theme with key `'onboarding'` is created
- THEN the system SHALL accept it as a valid `themeKey` value for experiences

_Note: The `onboarding` theme key does not require changes to `shared/enums.ts` directly — it is currently a freeform `string` on `Theme.key` and `BaseExperience.themeKey`. The spec requirement is that the key `'onboarding'` is recognized and functional throughout the system._

---

## 2. Backend: API Seed Data & Themes

### Requirement: onboarding theme exists in the themes table

The database MUST contain a theme row with:

- `key`: `'onboarding'`
- `labelKey`: `'experiences.categories.onboarding'`
- `order`: 4 (after the existing `community` theme)
- `applicableFormat`: `'trip'` (this theme applies to trip-format experiences)

#### Scenario: onboarding theme is seeded

- GIVEN the seed script runs against an empty database
- WHEN `SELECT * FROM sonora.themes WHERE key = 'onboarding'` is queried
- THEN a row SHALL exist with `key = 'onboarding'`, `labelKey = 'experiences.categories.onboarding'`, `order = 4`, and `applicableFormat = 'trip'`

### Requirement: instructions trip experience exists in the experiences table

The database MUST contain an experience row with:

- `slug`: `'instructions'`
- `format`: `'trip'`
- `themeKey`: `'onboarding'`
- `audioUrl`: `'experiences/instructions.mp3'`
- `durationSeconds`: `116`
- `latitude` and `longitude`: matching the Sonora location coordinates (`-32.211913`, `-64.73809012343702`)
- `free`: `true`
- `imageKey`: `'trip-instructions-cover'`
- `geofenceBypassable`: `false`

#### Scenario: Instructions trip is seeded

- GIVEN the seed script runs
- WHEN `SELECT * FROM sonora.experiences WHERE slug = 'instructions'` is queried
- THEN a row SHALL exist with:
  - `slug` = `'instructions'`
  - `format` = `'trip'`
  - `themeKey` = `'onboarding'`
  - `audioUrl` = `'experiences/instructions.mp3'`
  - `durationSeconds` = `116`
  - `free` = `true`
  - `imageKey` = `'trip-instructions-cover'`
  - `geofenceBypassable` = `false`

### Requirement: Instructions trip has a single waypoint

The instructions trip MUST have exactly one waypoint in the `waypoints` table, located at the Sonora location coordinates.

#### Scenario: Waypoint is seeded

- GIVEN the seed script runs
- WHEN the waypoints for the instructions experience are queried
- THEN exactly one row SHALL exist with:
  - `experienceId` = the UUID of the instructions experience
  - `order` = `1`
  - `latitude` = `-32.211913`
  - `longitude` = `-64.73809012343702`
  - `radiusMeters` = `50`

---

## 3. Mobile: Home Audio Player

### Requirement: HomeAudioPlayer resolves audio URL from the API

The `HomeAudioPlayer` component MUST resolve the instructions audio URL by fetching the experiences list from the API and locating the experience with `slug: 'instructions'`, using its `audioUrl` as the download source for `useTrackDownload`.

#### Scenario: API fetch succeeds and instructions trip is found

- GIVEN the `HomeAudioPlayer` component renders
- AND the API experiences endpoint returns a trip with `slug: 'instructions'`
- AND that trip has an `audioUrl` of `'experiences/instructions.mp3'`
- WHEN the component mounts
- THEN the download SHALL use the trip's `audioUrl` as the remote URL
- AND the download SHALL use the trip's UUID as the track identifier

### Requirement: APP_CONFIG.audio.instructionsUrl remains as fallback

The system MUST retain `APP_CONFIG.audio.instructionsUrl` and use it when the API fetch fails or the instructions trip is not found in the API response.

#### Scenario: API fetch fails

- GIVEN the `HomeAudioPlayer` component renders
- AND the API experiences endpoint returns an error or fails to respond
- WHEN the component mounts
- THEN `APP_CONFIG.audio.instructionsUrl` SHALL be used as the download source
- AND the download SHALL use `'instructions'` as the track identifier (preserving backward compatibility)

#### Scenario: Instructions trip not found in API response

- GIVEN the `HomeAudioPlayer` component renders
- AND the API experiences endpoint returns a successful response
- BUT no experience with `slug: 'instructions'` is present in the response
- WHEN the component mounts
- THEN `APP_CONFIG.audio.instructionsUrl` SHALL be used as the download source
- AND the download SHALL use `'instructions'` as the track identifier

### Requirement: Download track ID is the experience UUID when API is available

When the instructions trip is resolved from the API, the download track identifier MUST be the experience's UUID (not the hardcoded string `'instructions'`), and it MUST fall back to `'instructions'` when the API is unavailable.

#### Scenario: UUID-based download identifier

- GIVEN the API provides an instructions trip with UUID `'123e4567-e89b-12d3-a456-426614174000'`
- WHEN `useTrackDownload` is called
- THEN the first argument (trackId) SHALL be `'123e4567-e89b-12d3-a456-426614174000'`

---

## 4. Mobile: Image Assets

### Requirement: trip-instructions-cover maps to cover-instructions-1.png

The mobile app MUST map the image key `'trip-instructions-cover'` to the existing asset `cover-instructions-1.png` in the image constants file.

#### Scenario: Image key resolves to correct asset

- GIVEN the `TRACK_IMAGES` record in `constants/images.ts`
- WHEN `TRACK_IMAGES['trip-instructions-cover']` is accessed
- THEN it SHALL resolve to `require('@/assets/images/sonora/cover-instructions-1.png')` (the `SONORA_INSTRUCTIONS_BG` asset)

### Requirement: Default image fallback behavior remains unchanged

The `DEFAULT_TRACK_IMAGE` export in `constants/images.ts` MUST remain `'trips-deriva-centro-cover'`.

#### Scenario: Default image not affected

- GIVEN the `DEFAULT_TRACK_IMAGE` constant
- WHEN it is accessed
- THEN it SHALL still resolve to `TRACK_IMAGES['trips-deriva-centro-cover']`

---

## 5. Shared: Locales

### Requirement: Theme label key for onboarding exists in English locale

The English locale file MUST include the key `experiences.categories.onboarding` with a human-readable label for the onboarding theme.

#### Scenario: Onboarding category label in English

- GIVEN the English locale file
- WHEN `t('experiences.categories.onboarding')` is called
- THEN it SHALL return a non-empty string describing the category (e.g. `'Onboarding'`)

### Requirement: Theme label key for onboarding exists in Spanish locale

The Spanish locale file MUST include the key `experiences.categories.onboarding` with a human-readable label for the onboarding theme.

#### Scenario: Onboarding category label in Spanish

- GIVEN the Spanish locale file
- WHEN `t('experiences.categories.onboarding')` is called
- THEN it SHALL return a non-empty string describing the category (e.g. `'Introducción'`)

---

## Out of Scope

The following behaviors are explicitly NOT specified by this document:

- `HomeAudioPlayer` UI, layout, colors, or playback behavior changes
- Changes to the global player, navigation, or trip/track listing
- Changes to `experiences-view.tsx` (Derivas section)
- Removal of `SONORA_INSTRUCTIONS_BG` — it remains referenced by `track-map` and other consumers
- i18n translation key changes for the instructions card (title, name, subtitle — already exist)
- Changes to the audio auth bypass in `routes/audio.ts` for `experiences/instructions.mp3`

---

## Risk: Inferred Domain Boundaries

The proposal has no explicit `Capabilities` section. The domains above were inferred from the `Affected Areas` table in the proposal. If implementation reveals additional domains (e.g., API route changes for auth, or new database migrations), those domains must be spec'd before implementation proceeds.
