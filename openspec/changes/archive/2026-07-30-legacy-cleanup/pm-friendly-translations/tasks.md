# Tasks: pm-friendly-translations

> Non-technical PM web admin panel for editing translations served as runtime overrides on the mobile app.

## Phase 1: Shared Schemas + DB Schema

### 1.1 Create translation Zod schemas in shared package ✅

- [x] Create `packages/shared/src/schemas/translations.ts`
- [x] Export schemas: `TranslationEntrySchema` (lang: 2-letter ISO, key: non-empty screen.element.descriptor, value: non-empty), `TranslationBulkPayloadSchema` (array of entries, min 1, max 500), `TranslationsMapSchema` (Record<string, string>)
- [x] Export inferred types: `TranslationEntry`, `TranslationBulkPayload`, `TranslationsMap`
- [x] Export `TranslationsResponseSchema` for GET response (`Record<string, string>`)
- [x] **Deliverable**: `packages/shared/src/schemas/translations.ts` + `packages/shared/src/__tests__/translations.test.ts` (25 tests covering valid/invalid entries)

### 1.2 Export translation schemas from shared index ✅

- [x] Add `export * from './schemas/translations';` to `packages/shared/src/index.ts`
- [x] **Deliverable**: `packages/shared/src/index.ts` (modified)

### 1.3 Add translations table to DB schema ✅

- [x] Add `translations` table in `apps/api/src/db/schema.ts` using `sonoraSchema.table()` with composite PK `(lang, key)`:
  ```ts
  export const translations = sonoraSchema.table(
    'translations',
    {
      lang: text('lang').notNull(),
      key: text('key').notNull(),
      value: text('value').notNull(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => ({
      pk: primaryKey({ columns: [table.lang, table.key] }),
    }),
  );
  ```
- [x] Export types: `Translation`, `NewTranslation`
- [x] **Deliverable**: `apps/api/src/db/schema.ts` (modified)

### 1.4 Generate Drizzle migration ✅

- [x] Run `cd apps/api && bun run db:generate` to produce `apps/api/migrations/` with the translations table
- [x] **Deliverable**: New migration file `migrations/0006_romantic_the_enforcers.sql`

## Phase 2: API Routes

### 2.1 Create translations API route — GET (public)

- Create `apps/api/src/routes/translations.ts`
- `GET /api/translations/:lang` → public, returns `{ key: value }` flat JSON filtered by lang param
- Validate `:lang` matches `^[a-z]{2}$` (ISO 639-1); return empty object `{}` when no overrides
- `PUT /api/translations` → admin, Bearer ADMIN_API_KEY auth (same pattern as `audio.ts`), Zod-validated via `TranslationBulkPayloadSchema`, all-or-nothing batch rejection
- Use `onConflictDoUpdate` for upsert behavior
- Return `{ updated: number }` on success
- **Deliverable**: `apps/api/src/routes/translations.ts`

### 2.2 Wire translations router into main API

- Add `import { translationsRouter } from './routes/translations';` and `app.route('/api/translations', translationsRouter);` to `apps/api/src/index.ts`
- **Deliverable**: `apps/api/src/index.ts` (modified)

### 2.3 Create admin static file server

- Create `apps/api/src/admin-serve.ts` with a Hono router that serves admin SPA static files at `/admin/*`
- Use Hono's `serveStatic` or a simple catch-all that reads from a `dist/` directory relative to the Worker
- Export `adminServeRouter` for mounting in `apps/api/src/index.ts`
- Mount in `apps/api/src/index.ts`: `app.route('/admin', adminServeRouter);`
- **Deliverable**: `apps/api/src/admin-serve.ts` + `apps/api/src/index.ts` (modified)

## Phase 3: Mobile Store + Cache + i18n Wiring

### 3.1 Create translation cache (native)

- Create `apps/mobile/src/storage/translation-cache.ts`
- Pattern mirrors `config-cache.ts` exactly — use `expo-sqlite/kv-store`
- Functions: `getCachedTranslations(lang: string): Promise<Record<string, string> | null>`, `setCachedTranslations(lang: string, translations: Record<string, string>): Promise<void>`, `clearCachedTranslations(lang: string): Promise<void>`
- Cache key format: `translations:{lang}`
- Corrupted JSON → silent `null` return
- **Deliverable**: `apps/mobile/src/storage/translation-cache.ts`

### 3.2 Create translation cache (web)

- Create `apps/mobile/src/storage/translation-cache.web.ts`
- Same interface as native, uses `localStorage` instead of SQLite
- Same key format and error handling
- **Deliverable**: `apps/mobile/src/storage/translation-cache.web.ts`

### 3.3 Create translation store (Zustand)

- Create `apps/mobile/src/store/translation-store.ts`
- Pattern mirrors `remote-config-store.ts`:
  - State: `overridesByLang: Record<string, Record<string, string>>`, `isLoading: boolean`, `error: Error | null`
  - Method: `init()` — non-blocking, returns immediately
  - Flow: read cache first (instant render), then fetch API, validate each entry with `TranslationEntrySchema`, merge cache + API (API wins), write back to cache
  - `fetchLanguage(lang: string)` — fetches a specific language's overrides (called when language changes)
  - Timeout: 3000ms same as remote-config-store
- Merge precedence: API response > cache > built-in .ts
- No errors surfaced if network fails and no cache exists — silent .ts fallback
- **Deliverable**: `apps/mobile/src/store/translation-store.ts`

### 3.4 Wire translation overlay into i18n and layout

- In `apps/mobile/src/i18n/index.ts`:
  - Export an `addResources(resources: Record<string, Record<string, string>>)` function that calls `i18next.addResources(lang, 'translation', resources)` for each language
- In `apps/mobile/src/app/_layout.tsx`:
  - Import `useTranslationStore` and call `useTranslationStore.getState().init()` alongside existing `useRemoteConfigStore.getState().init()` in the init `useEffect`
  - After store resolves, call `addResources(store.overridesByLang)` to merge remote overrides into i18next
- Language change listener: when active language changes, fetch that language's overrides and merge
- **Deliverable**: `apps/mobile/src/i18n/index.ts` (modified), `apps/mobile/src/app/_layout.tsx` (modified)

## Phase 4: Admin Expo Web App

### 4.1 Scaffold admin Expo web app

- [ ] Create `apps/admin/` directory with:
  - [ ] `package.json` — `@sonora/shared` workspace dependency, expo, expo-router, react-native-web, nativewind, tw components compatible
  - [ ] `app.json` — Expo config with `web` platform only, `scheme: "admin"`
  - [ ] `tsconfig.json` — path aliases matching mobile pattern
  - [ ] `metro.config.js` — Expo web config
  - [ ] `global.css` — same `@theme` tokens as mobile `global.css` (colors, spacing, font sizes), same `@variant dark`
  - [ ] `src/tw/index.tsx` — same `TwView`, `TwText`, `TwPressable`, `TwTextInput`, `TwScrollView` pattern as mobile
  - [ ] `src/global.css` — imported in layout
- [ ] Scripts: `"web": "expo export --platform web"`, `"dev": "expo start --web"`
- [ ] **Deliverable**: `apps/admin/` directory with scaffolding files

### 4.2 Create admin layout + login gate + API client

- [ ] `apps/admin/src/app/_layout.tsx`:
  - [ ] Expo Router stack layout, imports `../global.css`
  - [ ] Login gate: checks for stored `admin_key` in localStorage, redirects to login page if absent
- [ ] `apps/admin/src/app/login.tsx`:
  - [ ] Simple form: API key input + "Log in" button
  - [ ] On submit: stores key in localStorage, redirects to `/`
- [ ] `apps/admin/src/services/admin-api-client.ts`:
  - [ ] Pattern mirrors mobile `api-client.ts` but simpler (no cache layer needed)
  - [ ] `getTranslations(lang: string)`, `setTranslations(payload: TranslationBulkPayload)` — both include `Authorization: Bearer <stored_key>` header
  - [ ] Uses `APP_CONFIG.apiBaseUrl` or env var for base URL
- [ ] `apps/admin/src/config/app-config.ts`:
  - [ ] `apiBaseUrl`: prioritize env var, default to `${location.origin}` (same Worker)
- [ ] **Deliverable**: `apps/admin/src/app/` files + `apps/admin/src/services/` + `apps/admin/src/config/`

### 4.3 Build translation editor page

- [ ] `apps/admin/src/app/index.tsx`:
  - [ ] Language tabs (en, es — extensible to more)
  - [ ] Searchable key-value table: filter by key substring
  - [ ] Rows with translated value + original .ts value side by side (for reference)
  - [ ] Inline edit: tapping a value opens editable input
  - [ ] Save button (commits all dirty entries via PUT /api/translations)
  - [ ] Loading state (`LoadingView`-style), error state with retry, empty state
  - [ ] Accessibility: `accessibilityLabel` on all interactive elements, `testID` for test targets
  - [ ] Uses `TwView`, `TwText`, `TwPressable`, `TwTextInput` consistently
- [ ] **Deliverable**: `apps/admin/src/app/index.tsx`

## Phase 5: Sync Script + GitHub Action

### 5.1 Create sync-translations script

- [ ] Create `scripts/sync-translations.ts`:
  - [ ] Queries `sonora.translations` from production Neon DB via Drizzle
  - [ ] Reads all `.ts` locale files from `apps/mobile/src/i18n/locales/`
  - [ ] Key-by-key diff: changed keys appear in PR, matching keys are excluded
  - [ ] If non-empty diff: creates branch `chore/sync-translations-<date>`, commits changes, creates PR via `gh` CLI
  - [ ] If empty diff: exits with "No changes detected" message
  - [ ] PR title: `chore: sync translations from admin panel — <date>`
  - [ ] PR body: includes summary of changed keys, reviewer checklist
- [ ] **Deliverable**: `scripts/sync-translations.ts`

### 5.2 Create GitHub Actions workflow

- [ ] Create `.github/workflows/sync-translations.yml`:
  - [ ] Triggers: `schedule` weekly (Mon 06:00 UTC), `workflow_dispatch`
  - [ ] Steps: checkout → setup bun → install → run `bun scripts/sync-translations.ts`
  - [ ] Needs `DATABASE_URL` secret, `GH_TOKEN` or `GITHUB_TOKEN` for PR creation
- [ ] **Deliverable**: `.github/workflows/sync-translations.yml`

## Phase 6: Tests

### 6.1 API route tests

- [x] Create `apps/api/src/__tests__/translations.test.ts`:
  - [x] `GET /api/translations/en` returns 200 with JSON object
  - [x] `GET /api/translations/en` returns empty object when no overrides exist
  - [x] `GET /api/translations/eng` returns 400 (invalid lang code)
  - [x] `PUT /api/translations` with valid ADMIN_API_KEY returns 200
  - [x] `PUT /api/translations` without auth returns 401
  - [x] `PUT /api/translations` with empty body returns 422
  - [x] Uses `app.request()` pattern from `config.test.ts`
- [x] **Deliverable**: `apps/api/src/__tests__/translations.test.ts`

### 6.2 Mobile store tests

- [x] Create `apps/mobile/src/store/__tests__/translation-store.test.ts`:
  - [x] Test `init()` loads cache first, then falls back to API
  - [x] Test `fetchLanguage()` fetches and caches by language
  - [x] Test error handling: network failure with no cache → silent fallback
  - [x] Test merge precedence: remote > cache > defaults
  - [x] Pattern mirrors `remote-config-store.test.ts`
- [x] **Deliverable**: `apps/mobile/src/store/__tests__/translation-store.test.ts`

### 6.3 Cache tests

- [x] Create `apps/mobile/src/storage/__tests__/translation-cache.test.ts`:
  - [x] Test `setCachedTranslations` + `getCachedTranslations` round-trip
  - [x] Test corrupted cache returns null
  - [x] Test `clearCachedTranslations` works
  - [x] Test language isolation (en cache doesn't affect es)
- [x] **Deliverable**: `apps/mobile/src/storage/__tests__/translation-cache.test.ts`

### 6.4 Sync script tests

- [ ] Create `scripts/__tests__/sync-translations.test.ts`:
  - [ ] Test diff logic: changed keys are detected, matching keys excluded
  - [ ] Test empty diff → no PR
  - [ ] Mock DB client and file system
- [ ] **Deliverable**: `scripts/__tests__/sync-translations.test.ts`

---

## Review Workload Forecast

| Metric                           | Value                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estimated changed lines**      | ~1,200 (shared 50 + db 20 + api 100 + admin-serve 20 + admin app 500 + mobile store 100 + cache 60 + i18n 25 + sync script 80 + github action 60 + tests 200) |
| **Review budget**                | 400 lines                                                                                                                                                     |
| **Budget risk**                  | **High** (3x over budget)                                                                                                                                     |
| **Chained PRs recommended**      | **Yes**                                                                                                                                                       |
| **Independent slices**           | Yes — shared/pkg, API, mobile, admin app, sync action all land independently                                                                                  |
| **Delivery strategy**            | ask-always                                                                                                                                                    |
| **Decision needed before apply** | **Yes** — choose chained PR strategy (stacked-to-main recommended: PR1 shared+api, PR2 mobile, PR3 admin app, PR4 sync action)                                |

---

## Work Unit Strategy (per work-unit-commits skill)

Each task above is an independent work unit with its own deliverable and tests. Recommend committing as:

| Commit / PR                                  | Files                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| PR 1: Shared schemas + DB schema + migration | `packages/shared/src/schemas/translations.ts`, `packages/shared/src/index.ts`, `apps/api/src/db/schema.ts`, migration, shared schema tests |
| PR 2: API routes + admin static serve        | `apps/api/src/routes/translations.ts`, `apps/api/src/index.ts`, `apps/api/src/admin-serve.ts`, API route tests                             |
| PR 3: Mobile store + cache + i18n wiring     | `apps/mobile/src/storage/translation-cache.ts`, `.web.ts`, `translation-store.ts`, i18n/index.ts, _layout.tsx, store + cache tests         |
| PR 4: Admin Expo web app                     | `apps/admin/**` (scaffolding + layout + pages + API client), admin-specific tests                                                          |
| PR 5: Sync script + GitHub Action            | `scripts/sync-translations.ts`, `.github/workflows/sync-translations.yml`, sync tests                                                      |

---

Reviewed: proposal, spec, design artifacts from Engram #3054, #3055, #3056
Skill rules applied: work-unit-commits (tests with code, commit by work unit), chained-pr (forecast override)
