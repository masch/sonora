# Design: PM-Friendly Translations

Non-blocking remote translation overrides served from Postgres through the same fetch-cache-merge pattern as `remote-config-store`, with an admin SPA for PM edits and a GitHub Action auto-PR sync back to git.

## Technical Approach

Mirror the proven remote-config pattern end-to-end: Drizzle schema → Hono API route → Zustand store → SQLite cache → merge over built-in `.ts` via i18next. The admin UI is a **separate Expo web app** (`apps/admin/`) built with `npx expo export --platform web`, served as static files by the same Worker at `/admin/*` catch-all. Uses the same stack (Expo SDK 56, Tailwind/NativeWind, `@sonora/shared`) — zero context switch for the team. No EAS builds consumed (web export only). A weekly cron Action diffs DB vs `.ts` and opens a PR for developer review.

## Architecture Decisions

| Topic              | Choice                                                                                        | Alternative                             | Rationale                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Schema**         | `sonora.translations` with composite PK `(lang, key)`                                         | Single-table with lang+key cols + index | Matches existing `sonora` schema; composite PK enforces uniqueness without extra index                                                 |
| **API GET**        | `/api/translations/:lang` → flat `Record<string,string>` JSON                                 | Nested namespaced JSON                  | Flat is simpler to merge; i18next resources use dot-keys internally                                                                    |
| **API PUT**        | Bulk upsert with Zod-validated `TranslationEntry[]`, all-or-nothing                           | Key-by-key endpoints                    | PM edits multiple keys per session; batch reduces round-trips and ensures atomicity                                                    |
| **Admin auth**     | `Bearer ADMIN_API_KEY` (same `audio.ts` pattern)                                              | Session/JWT                             | No new secrets, no session infrastructure, no login UX complexity                                                                      |
| **Mobile store**   | Zustand `useTranslationStore` cloning `remote-config-store.ts` exactly                        | React Context                           | Proven pattern: non-blocking init, signal timeout, cache-first, merge over defaults                                                    |
| **Cache**          | `expo-sqlite/kv-store` per-language keys `translations:en`, `translations:es`                 | Single JSON blob                        | Separate per-language scope avoids downloading all languages                                                                           |
| **Merge strategy** | Field-level: remote value for matching keys, `.ts` for everything else                        | Recursive deep-merge                    | Translations are flat `{key: string}` — no nesting beyond the flat key space                                                           |
| **Admin build**    | `npx expo export --platform web` from `apps/admin/`                                           | `bun build` + Vite                      | Same stack as mobile (Expo SDK 56, Tailwind, TwText, `@sonora/shared`) — zero context switch. No EAS builds consumed (web export only) |
| **Worker serving** | Catch-all `app.get('/admin/*', serveStatic)` from bundled `dist/` dir                         | Separate subdomain                      | No extra DNS config, no new Worker, deploy stays atomic                                                                                |
| **Sync Action**    | GitHub Action: cron weekly + `workflow_dispatch`                                              | Manual script                           | PR gives devs review control; cron catches stale overrides before they drift too far                                                   |
| **DB→.ts diff**    | Script queries DB, groups by lang, diffs against `apps/mobile/src/i18n/locales/{lang}.ts` AST | Full file replacement                   | Diff preserves unrelated changes, only PRs actual PM edits                                                                             |

## Design Principles (Consistency with Mobile)

The admin Expo app MUST mirror the mobile app's architecture patterns. This is NOT optional — it ensures zero context switch for developers and predictable maintenance.

| Aspect                   | Mobile (apps/mobile/)                                        | Admin (apps/admin/)                                           |
| ------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------- |
| **Routing**              | Expo Router file-based in `src/app/`                         | ✅ Same — `src/app/` with file-based routes                   |
| **Components**           | `ScreenWrapper`, `ScrollScreenWrapper`, `ThemedText`, `Icon` | ✅ Same — reuse from shared or mirror                         |
| **Styling**              | Tailwind/NativeWind via `TwView`, `TwText`, `TwPressable`    | ✅ Same — `Tw*` components, `className`                       |
| **Theme**                | CSS variables in `global.css` + `use-color-scheme` hooks     | ✅ Same — same `global.css` tokens, same hooks                |
| **Data fetching**        | `ApiClient` from `apps/mobile/src/services/api-client.ts`    | ✅ Same pattern — new `api.ts` in admin, same conventions     |
| **Validation**           | Zod schemas from `@sonora/shared`                            | ✅ Same — import `TranslationEntrySchema` from shared package |
| **i18n**                 | `useAppTranslation()` hook                                   | ✅ Same — admin is also translated with i18next               |
| **Loading/Error/Empty**  | `LoadingView`, `ErrorBoundary`, explicit empty states        | ✅ Same — same patterns for every async view                  |
| **Accessibility**        | `accessibilityLabel` on every Pressable, `testID` kebab-case | ✅ Same — applies to admin too                                |
| **ESLint / conventions** | `i18next/no-literal-string`, strict TypeScript               | ✅ Same config applied                                        |

**Decision**: The admin codebase (`apps/admin/`) reuses the same `Tw*` components, theme system, shared schemas, and coding conventions as the mobile app. It imports from the same `@sonora/shared` package. Any new pattern introduced for the admin that's general-purpose MUST also be available for the mobile app.

## Data Flow

```
┌──────────────┐   PUT /api/translations    ┌──────────────┐
│  PM Admin SPA │ ──── (Bearer ADMIN_API_KEY) ────► │    Worker     │
│  (apps/admin/)│ ◄────── 200 OK ──────────   │ (Hono routes)│
└──────────────┘                               └──────┬───────┘
                                                      │
                                           ┌──────────▼──────────┐
                                           │  Postgres (Neon)   │
                                           │ sonora.translations │
                                           └──────────┬──────────┘
                                                      │
              ┌───────────────────────────────────────┼──────────────────────┐
              │                                       │                      │
              ▼                                       ▼                      ▼
┌─────────────────────┐              ┌─────────────────────────┐   ┌──────────────┐
│  Mobile App init     │              │  GitHub Action (cron)   │   │  .ts locales  │
│                      │              │                         │   │  (git source │
│  1. Render .ts       │              │  1. SELECT lang, key,   │   │   of truth)  │
│  2. GET /api/transl  │              │     value FROM DB       │   └──────┬───────┘
│     /:lang           │              │  2. Diff vs {lang}.ts   │          │
│  3. SQLite cache     │              │  3. Non-empty → PR      │          │
│  4. Merge into       │              └─────────────────────────┘          │
│     i18next          │                                                  │
└─────────────────────┘                                                   │
                                                                          │
     Merge priority: remote > cache > .ts                                 │
```

## File Changes

| File                                               | Action | Description                                                                          |
| -------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| `packages/shared/src/schemas/translations.ts`      | Create | `TranslationEntrySchema`, `TranslationPayload` and `TranslationResponse` Zod schemas |
| `packages/shared/src/index.ts`                     | Modify | Export new translations schemas                                                      |
| `apps/api/src/db/schema.ts`                        | Modify | Add `sonoraSchema.table('translations')` with composite PK `(lang, key)`             |
| `apps/api/src/routes/translations.ts`              | Create | `GET /:lang` (public) + `PUT /` (admin, Bearer auth)                                 |
| `apps/api/src/index.ts`                            | Modify | Mount `translationsRouter` at `/api/translations`                                    |
| `apps/admin/`                                      | Create | Expo web app (app.json, package.json, tsconfig.json, src/app/)                       |
| `apps/admin/app.json`                              | Create | Expo config (web platform only, slug: "sonora-admin")                                |
| `apps/admin/package.json`                          | Create | Expo SDK 56, react-native, expo-router, @sonora/shared, nativewind, tw components    |
| `apps/admin/src/app/_layout.tsx`                   | Create | Expo Router layout: login gate, sidebar navigation                                   |
| `apps/admin/src/app/index.tsx`                     | Create | Redirect to `/translations`                                                          |
| `apps/admin/src/app/translations.tsx`              | Create | Main page: language tabs, searchable key-value table, inline edit, Save              |
| `apps/admin/src/api.ts`                            | Create | `fetchTranslation(lang)` and `saveTranslations(entries)` with ADMIN_API_KEY          |
| `apps/admin/src/app/global.css`                    | Create | Tailwind CSS entry (same pattern as mobile `global.css`)                             |
| `apps/admin/tailwind.config.js`                    | Create | Tailwind config matching mobile setup                                                |
| `apps/api/src/admin-serve.ts`                      | Create | Static file middleware for `/admin/*` catch-all (serves Expo web export `dist/`)     |
| `apps/mobile/src/store/translation-store.ts`       | Create | `useTranslationStore` Zustand store (mirrors remote-config-store)                    |
| `apps/mobile/src/storage/translation-cache.ts`     | Create | `expo-sqlite/kv-store` per-language cache (`translations:en`, `translations:es`)     |
| `apps/mobile/src/storage/translation-cache.web.ts` | Create | `localStorage` per-language variant                                                  |
| `apps/mobile/src/i18n/index.ts`                    | Modify | After init, call `useTranslationStore.getState().init()` to fetch+merge              |
| `apps/mobile/src/app/_layout.tsx`                  | Modify | Add `useEffect` for translation store init (alongside remote config)                 |
| `.github/workflows/sync-translations.yml`          | Create | Cron + workflow_dispatch: DB query → diff → PR                                       |
| `scripts/sync-translations.ts`                     | Create | Script that queries DB, diffs .ts, creates branch+PR                                 |

## Interfaces / Contracts

```typescript
// ─── packages/shared/src/schemas/translations.ts ───
import { z } from 'zod';

export const TranslationEntrySchema = z.object({
  lang: z.string().length(2), // ISO 639-1
  key: z.string().min(1), // dot-separated, e.g. "common.learnMore"
  value: z.string().min(1), // translated string
});
export type TranslationEntry = z.infer<typeof TranslationEntrySchema>;

export const TranslationPayloadSchema = z.object({
  entries: z.array(TranslationEntrySchema).min(1),
});
export type TranslationPayload = z.infer<typeof TranslationPayloadSchema>;

// API response: GET /api/translations/en → { "common.learnMore": "Learn more", … }
export const TranslationResponseSchema = z.record(z.string(), z.string());
export type TranslationResponse = z.infer<typeof TranslationResponseSchema>;
```

```typescript
// ─── apps/mobile/src/store/translation-store.ts ───
interface TranslationState {
  translations: Record<string, string>; // flat key→value for active lang
  isLoading: boolean;
  error: Error | null;
  init: (lang: string) => Promise<void>;
}
// Mirrors useRemoteConfigStore exactly: cache-first, fetch with timeout, merge
```

```typescript
// ─── API contracts ───
// GET /api/translations/:lang
// 200: { "common.learnMore": "Learn more", … }
// (empty object when no overrides)
//
// PUT /api/translations
// Authorization: Bearer <ADMIN_API_KEY>
// Body: { entries: [{ lang: "en", key: "common.learnMore", value: "Learn more" }] }
// 200: { updated: 3 }
// 400: { error: "Validation failed", details: […] }
// 401: { error: "Unauthorized" }
```

## Testing Strategy

| Layer              | What                                                                   | Approach                                         |
| ------------------ | ---------------------------------------------------------------------- | ------------------------------------------------ |
| Unit (shared)      | `TranslationEntrySchema` validation (valid + invalid entries)          | Vitest, `safeParse`                              |
| Unit (shared)      | `TranslationPayloadSchema` batch validation (empty array, mixed langs) | Vitest, all-or-nothing edge cases                |
| Integration (API)  | `GET /api/translations/:lang` returns correct shape                    | Hono `app.request()` + mock DB client            |
| Integration (API)  | `PUT /api/translations` rejects without auth                           | Missing/wrong Bearer header → 401                |
| Integration (API)  | `PUT /api/translations` all-or-nothing batch                           | Malformed entry in batch → 400, no partial write |
| Unit (mobile)      | Store init: cache-first, fetch with timeout                            | Mock `ApiClient`, mock cache                     |
| Unit (mobile)      | Merge: remote > cache > .ts                                            | Unit test merge function with known inputs       |
| Unit (cache)       | Corrupt data silently dropped                                          | `JSON.parse` throw test                          |
| Unit (sync)        | Diff logic: DB rows vs .ts object                                      | Vitest, mock DB query result                     |
| Integration (sync) | Scaffold: script runs + exits cleanly                                  | Vitest, mock `gh` CLI calls                      |

## Migration / Rollout

1. `make api-db-generate` → Drizzle Kit creates migration `0006` for `sonora.translations`
2. Apply migration to staging first, then production (`make api-db-migrate-staging` / `make api-db-migrate-production`)
3. Seed from current `.ts` values with a one-shot seed script
4. Deploy Worker (with new routes + admin SPA)
5. Submit mobile update (OTA via Expo Update or store release)
6. **Rollback**: `wrangler rollback`, `DELETE FROM sonora.translations`, revert mobile changes

## Open Questions

None — all decisions resolve from the specs and existing codebase patterns (remote-config-store, audio.ts auth, Drizzle schema conventions).
