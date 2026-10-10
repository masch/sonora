# Feature: Experience & General Lead Capture

**Feature ID:** `lead-capture`  
**Branch:** `feat/lead-capture`  
**Strategy:** `ask-on-risk`

## Objective

Allow users to leave a contact email from the experience detail screens (`TrackDetailView` and `TripDetailView`) as well as general platform inquiries, persisting leads with a typed `lead_source` enum and optional `experience_id`.

## Constraints & Conventions

- `LEAD_SOURCES` defined as `['track_detail', 'trip_detail'] as const` in `@sonora/shared/src/enums.ts`.
- Postgres schema in Drizzle (`apps/api/src/db/schema.ts`) uses `sonoraSchema.enum('lead_source', [...LEAD_SOURCES])` and `leads` table with nullable `experience_id`.
- Request validation via Zod in `@sonora/shared`, with valid email requirement (`z.string().email()`).
- Endpoint `POST /leads` in `apps/api` with rate limiting, error handling, and idempotent acceptance.
- User-facing copy goes through `useAppTranslation` in both `es` and `en` locales (no hardcoded strings, compliant with `i18next/no-literal-string`).
- Mobile UI utilizes `BottomModal`, `TwTextInput`, `TwPressable`, and `ThemedText` with proper accessibility (`accessibilityLabel`, `testID`).
- Strict TDD (Red -> Green -> Refactor) and `make validate` verification.

## Tasks

- [x] **Task 1: Shared Lead Enums, Schemas & Contracts**
  - Path: `packages/shared/src/enums.ts`, `packages/shared/src/schemas/lead.ts`, `packages/shared/src/index.ts`, `packages/shared/src/__tests__/lead.test.ts`
  - Action: Define `LEAD_SOURCES`, `LeadSource`, Zod validation schemas, and request/response interfaces with unit tests.
  - Proof: `bun test packages/shared` passes (207 tests across 14 files).

- [x] **Task 2: API DB Migration & Leads Route**
  - Path: `apps/api/src/db/schema.ts`, `apps/api/src/routes/leads.ts`, `apps/api/src/index.ts`, `apps/api/src/__tests__/leads.test.ts`, `apps/api/migrations/0020_rich_bullseye.sql`
  - Action: Add `leadSourceEnum` and `leads` table to Drizzle, generate migration, implement `POST /leads` handler with rate limiting, idempotency handling, and integration tests.
  - Proof: `bun run --cwd apps/api test` passes (51 test files, 577 tests), `tsc --noEmit` passes.

- [x] **Task 3: Shared Locales for Lead Capture**
  - Path: `packages/shared/src/locales/es.ts`, `packages/shared/src/locales/en.ts`
  - Action: Add i18n keys for lead capture action button, modal header, placeholder, submit button, loading, validation error, and success confirmation.
  - Proof: `bun test packages/shared` passes (207 tests across 14 files), `apps/mobile tsc --noEmit` passes cleanly.

- [x] **Task 4: Mobile Lead Capture Modal & Detail Integration**
  - Path: `apps/mobile/src/components/lead-capture-modal.tsx`, `apps/mobile/src/components/track-detail-view.tsx`, `apps/mobile/src/components/trip-detail-view.tsx`, `apps/mobile/src/services/lead-client.ts`, `apps/mobile/src/__tests__/lead-capture-modal.test.tsx`
  - Action: Build accessible `LeadCaptureModal`, integrate contact button in track and trip detail views, hook up API client with feedback states.
  - Proof: Mobile Jest tests pass (29 passed across 4 suites), `expo lint` & `tsc --noEmit` pass cleanly.

- [x] **Task 5: Full Validation & Quality Gate**
  - Action: Run `make validate` (linter, types, tests, GGA).
  - Proof: `make validate` passes cleanly across all workspaces (API, Shared, Mobile, Admin, GGA).
