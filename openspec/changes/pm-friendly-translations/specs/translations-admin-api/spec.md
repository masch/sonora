# Translations Admin API Specification

## Purpose

Expose Postgres-stored translation overrides via public read and admin write endpoints on the existing Hono Worker, and serve an authenticated React SPA admin UI for PM edits that can grow with future features.

## Requirements

### Requirement: Database Schema

The system MUST define a `sonora.translations` table in the existing Drizzle schema (`apps/api/src/db/schema.ts`) with a composite primary key of `(lang, key)`.

| Column       | Type                       | Constraints              |
| ------------ | -------------------------- | ------------------------ |
| `lang`       | `text`                     | PK, not null, ISO 639-1  |
| `key`        | `text`                     | PK, not null             |
| `value`      | `text`                     | not null                 |
| `updated_at` | `timestamp with time zone` | `defaultNow()`, not null |

#### Scenario: Migration creates table

- GIVEN the migration runs on the Neon database
- WHEN `drizzle-kit migrate` executes
- THEN the `sonora.translations` table exists with composite PK `(lang, key)`

#### Scenario: Duplicate PK is rejected

- GIVEN a row `('en', 'explore.title', 'Explore')` exists
- WHEN a second row with the same PK is inserted
- THEN the insert violates the PK constraint and fails

### Requirement: Public Read Endpoint

`GET /api/translations/:lang` MUST return all translations for the requested language as a flat JSON object `{ key: value }`. The endpoint MUST be unauthenticated. The `:lang` param MUST be a two-letter ISO 639-1 code. An empty object `{}` MUST be returned when no overrides exist (not an error).

#### Scenario: Language with overrides

- GIVEN DB rows for `('en', 'explore.title', 'Explore')` and `('en', 'settings.label', 'Settings')`
- WHEN a client calls `GET /api/translations/en`
- THEN the response is `200` with body `{ "explore.title": "Explore", "settings.label": "Settings" }`

#### Scenario: Language with no overrides

- GIVEN no rows exist for `'es'`
- WHEN a client calls `GET /api/translations/es`
- THEN the response is `200` with body `{}`

#### Scenario: Invalid language code

- GIVEN `:lang` is `'eng'` (three letters)
- WHEN a client calls `GET /api/translations/eng`
- THEN the response is `400` with an error indicating invalid language code

### Requirement: Admin Bulk Upsert Endpoint

`PUT /api/translations` MUST accept an array of translation entries and upsert them into the database. The endpoint MUST require a valid `ADMIN_API_KEY` Bearer token in the `Authorization` header. Each entry MUST be validated by `TranslationEntrySchema` before insertion. On validation failure, the entire batch MUST be rejected — no partial upsert.

#### Scenario: Authorized bulk upsert

- GIVEN the request has `Authorization: Bearer <valid ADMIN_API_KEY>` and body `[{ "lang": "en", "key": "explore.title", "value": "Discover" }]`
- WHEN the endpoint processes the request
- THEN the DB upserts the row and the response is `200`

#### Scenario: Missing auth header

- GIVEN the request has no `Authorization` header
- WHEN a client calls `PUT /api/translations`
- THEN the response is `401` Unauthorized

#### Scenario: Invalid entry rejects entire batch

- GIVEN the body contains `[{ "lang": "en", "key": "", "value": "X" }]` (empty key)
- WHEN validation runs
- THEN the response is `422` with validation errors; no rows are written

### Requirement: Zod Shared Schema

The system MUST define `TranslationEntrySchema` in `packages/shared/src/schemas.ts` (or a new `translations.ts` file). The schema MUST validate: `lang` — two-letter ISO 639-1 string, `key` — non-empty string matching `screen.element.descriptor` convention, `value` — non-empty string.

#### Scenario: Valid entry passes

- GIVEN `{ lang: "es", key: "explore.title", value: "Explorar" }`
- WHEN `TranslationEntrySchema.parse()` is called
- THEN it succeeds and returns the validated object

#### Scenario: Invalid lang fails

- GIVEN `{ lang: "xyz", key: "explore.title", value: "X" }`
- WHEN `TranslationEntrySchema.parse()` is called
- THEN it throws a ZodError citing the `lang` field

### Requirement: Admin SPA served from Worker

The system MUST include a React SPA within the monorepo at `apps/admin/`, built with `bun build` and served by the Worker at `/admin/*`. The SPA MUST include a login gate, language tabs (`en` / `es`), searchable key-value table, inline editing, and Save. Authentication uses the existing `ADMIN_API_KEY` presented via a login prompt (stored in sessionStorage, sent as `Authorization: Bearer` on API calls). The Worker must mount a catch-all route for `GET /admin*` that serves the SPA's static build output.

#### Scenario: Unauthenticated access

- GIVEN a browser visits `/admin/translations` without credentials
- WHEN the SPA loads
- THEN it displays a login form, not the editor

#### Scenario: Authenticated edit flow

- GIVEN the PM enters a valid ADMIN_API_KEY
- WHEN the editor renders with current translations for `en` and `es`
- THEN the PM can search keys, edit a value, click Save, and see a confirmation message

#### Scenario: New admin page added (future)

- GIVEN a developer adds a new page to `apps/admin/src/pages/experiences.tsx`
- WHEN the SPA is rebuilt and deployed
- THEN the new page is available at `/admin/experiences` without Worker route changes
