## Proposal: pm-friendly-translations

### Intent

Give a non-technical PM a web admin panel to edit translations that are served as runtime overrides to the mobile app while keeping the existing `.ts` files as the type-safe offline fallback that developers own.

### Capabilities

| Who            | Can do                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------- |
| PM             | Log in with shared secret, browse translations by language (en/es), edit values, save to Postgres |
| PM             | See current app translations and their remote overrides in one view                               |
| Mobile user    | Get latest translations on app init (non-blocking, cached to SQLite)                              |
| Mobile user    | Always see built-in `.ts` translations when offline                                               |
| Developer      | Review PM's changes via auto-PR before they land in git                                           |
| GitHub Actions | Cron + workflow_dispatch compares DB vs `.ts`, opens PR if different                              |

### Scope

**In scope**:

- Drizzle schema: `sonora.translations` table (lang, key, value, updated_at) — same schema as `sonora.themes`
- API routes: `GET /api/translations/:lang` (public) + `PUT /api/translations/*` (admin, Bearer ADMIN_API_KEY)
- Zod shared schemas in `packages/shared` for the translation payload (validated on write and read)
- Admin SPA: `apps/admin/` — React SPA in the monorepo, built with `bun build`, served by Worker at `/admin/*`
- Mobile: new `useTranslationStore` (Zustand) mirroring `remote-config-store` — fetch → cache → merge over built-in `.ts`
- Cache: `translations-cache.ts` / `.web.ts` mirroring `config-cache.ts`
- GitHub Action: `.github/workflows/sync-translations.yml` — cron (weekly) + workflow_dispatch; diffs DB vs `.ts` and creates PR

**Out of scope**:

- OAuth/session-based auth (stays shared-secret with ADMIN_API_KEY)
- Full CMS features (version history, approval workflows, translation imports/exports)
- Plural forms, ICU MessageFormat, or i18next resource format changes
- New key creation from admin panel (keys are developer-owned in `.ts`)
- Push notifications or SSE for real-time translation sync
- Backfill migration — first deploy seeds from current `.ts` values

### Approach

The design follows the existing `remote-config` pattern exactly:

| Layer        | Remote Config                            | Translations                               |
| ------------ | ---------------------------------------- | ------------------------------------------ |
| API route    | `GET /api/config`                        | `GET /api/translations/:lang`              |
| Admin write  | Env vars (CF Dashboard)                  | `PUT /api/translations` (admin UI → API)   |
| Zod schema   | `RemoteConfigPayloadSchema` in shared    | `TranslationPayloadSchema` in shared       |
| Mobile store | `remote-config-store.ts` (Zustand)       | `translation-store.ts` (new, same pattern) |
| Cache        | `config-cache.ts` (expo-sqlite/kv-store) | `translations-cache.ts` (new, same API)    |
| Fallback     | `DEFAULT_REMOTE_CONFIG` constants        | `en.ts` / `es.ts` `as const` objects       |

Admin UI is a React SPA (`apps/admin/`) built with `bun build` and served from the same Worker at `/admin/*` — authenticated, renders language tabs + key-value table. Grows with future features without changing the architecture.

### Key Decisions

- **Storage**: Postgres (Neon) via Drizzle, not KV — translations are structured data with per-key granularity, same `sonora` schema namespace as existing tables
- **Merge precedence**: Remote DB values win over `.ts` defaults for matching keys. Keys absent in remote fall through to `.ts` without warning (type-safe partial override)
- **Sync direction**: Developer → `.ts` (source of truth for key structure), PM → DB (runtime overrides). Auto-PR syncs DB changes back to `.ts` for review
- **No new infra**: Same Worker, same DB, same `ADMIN_API_KEY` — zero new dependencies

### Risks

| Risk                           | Impact                 | Mitigation                                                                              |
| ------------------------------ | ---------------------- | --------------------------------------------------------------------------------------- |
| Key drift between `.ts` and DB | CI catches it          | Auto-PR keeps them in sync; admin UI reads keys from API which validates against schema |
| Admin auth is shared secret    | Low for PM-only access | Same model as audio upload; upgrade to OAuth later if needed                            |
| Mobile fetch blocks render     | UX regression          | Non-blocking init (same as remote-config); `.ts` renders immediately                    |
| Bundle size increase           | Minimal                | Zustand store is ~1KB; cache layer reuses existing SQLite pattern                       |

### Rollback Plan

1. **Revert API deployment**: `wrangler rollback` to previous version
2. **Clear translations table**: `DELETE FROM sonora.translations` — app falls back to `.ts`
3. **Remove mobile store**: Remove fetch from `_layout.tsx`, delete `translation-store.ts`
4. **Delete GitHub Action**: Remove workflow file

### Success Criteria

- [ ] PM can log in, view all en/es keys, edit any value, save, and see the change live in the app
- [ ] Mobile app renders immediately with `.ts` translations, then overlays remote values non-blocking
- [ ] App works fully offline with no network
- [ ] Auto-PR is created when DB translations differ from `.ts` (tested via workflow_dispatch)
- [ ] All existing tests pass (`make validate`)

### Ready for Spec

Yes — all architectural decisions are settled, the remote-config pattern is proven, and the scope fits neatly within existing infra.
