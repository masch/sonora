## Exploration: pm-friendly-translations

### Current State

**i18n infrastructure**:

- **Library**: i18next 26.3.0 + react-i18next 17.0.8
- **Languages**: English (`en`) and Spanish (`es`) — TypeScript `as const` objects
- **Translation keys**: ~208 leaf keys across 15 namespaces (`common`, `map`, `tabs`, `experiences`, `home`, `index`, `audio`, `components`, `feedback`, `errors`, `explore`, `settings`, `versionCheck`, `messages`)
- **Key naming**: `{screen}.{section}.{element}` (dot-separated, e.g. `explore.title`, `home.hints.editing`)
- **Type safety**: `TranslationKeys` union type derived from `typeof en` via `RecursiveKeyOf` — compile-time autocomplete and safety
- **Init**: Side-effect `import '@/i18n'` in `_layout.tsx` — no Provider wrapping needed (i18next singleton)
- **Locale detection**: `expo-localization.getLocales()` on init, falls back to `'en'`
- **Consumption**: `useAppTranslation()` hook wraps `react-i18next`'s `useTranslation()` with typed `t()` function
- **ESLint**: `eslint-plugin-i18next` (`i18next/no-literal-string` rule) prevents hardcoded user-facing strings
- **Test mock**: `__mocks__/react-i18next.ts` returns key as value — tests assert on translation keys, not values

**Data flow today**:

```
_app-layout.tsx → import '@/i18n' (side-effect init)
  → expo-localization detects language
  → i18next.init({ resources: { en, es } })
  → Components call t('explore.title') at runtime
```

All translations are **compile-time** — bundled inside the app binary as `as const` TypeScript objects.

**Backend architecture** (the "No backend" in sdd-init config.yaml is outdated):

- `apps/api/` — Cloudflare Workers API using **Hono** framework
- **Neon Postgres** with **Drizzle ORM** for data persistence
- Routes: `/config`, `/themes`, `/experiences`, `/audio`, `/feedback`, `/health`
- Monorepo with `packages/shared/` for shared types/Zod schemas
- Already has `ADMIN_API_KEY` in `Env` interface (unused so far)
- Deployed via Wrangler with prod + staging environments
- Existing **remote-config pattern** (`GET /api/config` + mobile fetch + cache + merge) is the exact template for dynamic translations

### Affected Areas

- `apps/mobile/src/i18n/locales/en.ts` — source of truth for English translations (208 keys, 15 namespaces)
- `apps/mobile/src/i18n/locales/es.ts` — Spanish translations (same shape)
- `apps/mobile/src/i18n/index.ts` — i18next init (currently static resources)
- `apps/mobile/src/i18n/types.ts` — `TranslationKeys` type derived from `en`
- `apps/mobile/src/hooks/use-translation.ts` — typed `t()` wrapper
- `apps/mobile/src/services/api-client.ts` — existing HTTP client, reusable for fetching translations
- `apps/mobile/src/store/remote-config-store.ts` — **reference pattern** for dynamic config fetch + cache + merge
- `apps/mobile/src/storage/config-cache.ts` + `.web.ts` — **reference pattern** for cache storage
- `apps/api/src/index.ts` — mount translation routes
- `apps/api/src/routes/` — new `translations.ts` router
- `packages/shared/src/` — new shared types/schemas for translation payloads
- `apps/api/src/db/schema.ts` — optional translations table (if using DB)
- `apps/api/wrangler.toml` — env vars for admin API key
- `apps/mobile/src/__tests__/i18n.test.ts` — test for translation key completeness

### Approaches

1. **Cloudflare Worker + Admin Dashboard (recommended)** — `GET /api/translations/:lang` endpoint + admin UI
   - Leverage existing Cloudflare Workers API with Hono
   - New `translations` table in Postgres (or D1 for simplicity) with `{ lang, key, value }` schema
   - `GET /api/translations/:lang` returns all translations for a language
   - `PUT /api/translations/:lang` (admin-only, authenticated via `ADMIN_API_KEY`) for bulk updates
   - Admin web UI: lightweight dashboard rendered as a route on the same API or a separate Cloudflare Pages site
   - Mobile: new `useTranslationStore` (Zustand) that fetches remote translations on init, merges with built-in defaults, and caches locally
   - Built-in `en.ts` / `es.ts` serve as offline fallback — remote values override local
   - **Effort**: Medium
   - **Pros**:
     - Follows existing `remote-config-store` pattern exactly — reuse architecture, caching, type-safety patterns
     - No new infrastructure needed (uses existing Cloudflare Workers + Postgres)
     - PM accesses via web URL — no app deployment needed for text changes
     - Offline-resilient: built-in translations always available as fallback
     - `ADMIN_API_KEY` env var already defined in API
     - Zod validation for type safety
   - **Cons**:
     - Admin UI needs to be built from scratch (no existing admin panel)
     - Adds DB migration and new API route
     - Changes don't apply until app fetches new translations (could add polling/SSE)

2. **Admin screen inside the mobile app (web-only)** — Embedded translation editor as a web route
   - Add a `/admin/translations` route in the Expo app (web-only via Platform detection)
   - PM can edit translations in-app on the web version
   - Saves to API endpoint
   - **Effort**: Medium
   - **Pros**:
     - Same codebase, no separate deployment
     - PM uses the same app
   - **Cons**:
     - Only works on web — PM can't edit from a desktop browser separately from the app
     - Translation editing bundled with app releases — not truly decoupled
     - Web-only routes in Expo router add complexity
     - Doesn't scale if PM needs to manage translations across multiple environments

3. **External translation management platform (POEditor, Lokalise, Crowdin)** with auto-sync
   - Use POEditor/Lokalise/Crowdin API to sync translations
   - Add a sync endpoint to the API that pulls from the platform on a schedule
   - Mobile fetches from API (same as Approach A)
   - **Effort**: Low (integration) / Medium (sync pipeline)
   - **Pros**:
     - Battle-tested translation management UI
     - Professional translation workflow (collaboration, review, versioning)
     - Integrates with CI/CD
   - **Cons**:
     - **External dependency** with monthly cost
     - PM needs to learn another tool
     - Overkill for a project with 2 languages and ~200 keys
     - Sync pipeline adds complexity (webhooks, scheduled updates)
     - Data sovereignty concerns (translations stored on third-party servers)

4. **Lightweight admin dashboard as standalone web app**
   - Separate Cloudflare Pages site or Next.js app
   - Authenticates via API key or session
   - Talks to the same API
   - **Effort**: High
   - **Pros**:
     - Fully decoupled — can evolve independently
     - Can be built with any framework
   - **Cons**:
     - Two deployments to manage
     - Duplicate authentication boilerplate
     - Over-engineered for the current scope
     - Separate codebase to maintain

### Recommendation

**Approach 1: Cloudflare Worker endpoint + simple admin panel**

This is the clear winner because it maps 1:1 onto the existing `remote-config` pattern that's already proven in production. The architecture is identical:

| Aspect       | Remote Config                 | Translations                               |
| ------------ | ----------------------------- | ------------------------------------------ |
| API route    | `GET /api/config`             | `GET /api/translations/:lang`              |
| Admin write  | Cloudflare Dashboard env vars | `PUT /api/translations/:lang` (admin auth) |
| Mobile store | `remote-config-store.ts`      | `translation-store.ts` (new)               |
| Cache        | `config-cache.ts`             | `translations-cache.ts` (new)              |
| Fallback     | `APP_CONFIG` defaults         | built-in `en.ts` / `es.ts`                 |
| Schema       | `RemoteConfigPayload` (Zod)   | `TranslationPayload` (Zod, new)            |

The admin dashboard can be a simple web page served as a route on the same Hono API (like a mini SPA with a form), avoiding a separate deployment. Authentication uses the existing `ADMIN_API_KEY` env var — PM logs in with a shared secret, edits translations in a web form, and submits.

This approach keeps changes **within the existing architectural boundaries**, respects the monorepo structure, and delivers zero-downtime translation updates without app store releases.

### Risks

- **Offline-first constraint**: Translations must never block render. The built-in `en.ts`/`es.ts` files remain the source of truth for initial render and offline use. Remote translations are a non-blocking overlay — same pattern as remote config.
- **Key sync**: If a developer adds a new key to `en.ts`, the admin UI won't show it until the schema is updated. Mitigation: the `PUT` endpoint validates against expected keys, and the admin UI should auto-discover keys from the latest bundle.
- **Type safety erosion**: Remote translations bypass compile-time type checking. Mitigation: Zod validates the payload shape on both write (API) and read (mobile), and built-in defaults guarantee type coverage even if remote returns partial data.
- **Admin auth simplicity**: Using a shared `ADMIN_API_KEY` env var (already defined) is sufficient for MVP. Can be upgraded to OAuth/session-based auth later.
- **Bundle size**: Adding remote translation fetching adds some payload. Negligible since it follows the existing pattern and only adds a small Zustand store.
- **PM adoption**: The admin UI must be simple enough for a non-technical PM to use without training. The form should show language tabs + key search/filter + save preview.

### Ready for Proposal

Yes — the recommended approach is clear, the existing `remote-config-store` pattern provides a ready-made template, and the API infrastructure is already in place. The proposal should define the admin UI scope (MVP vs full CMS), the translation cache strategy, and the merge precedence rules.
