## Exploration: App Version Check

### Current State

**No authentication system exists.** The Sonora app is a public, location-based audio experience app with no user accounts or login flow. The app opens directly to the home screen — there is no auth gate. This means the version check must happen at **app startup** in the root layout, not at login.

**Config route** (`GET /api/config`) serves a static `RemoteConfigPayload` with three sections: `geofence`, `audio`, and `feedback`. It has **no version-related data**. The route is stateless (no DB calls) and returns hardcoded defaults from `@sonora/shared`.

**Remote config store** (`useRemoteConfigStore`, Zustand) already fetches `/config` on app init (called in `src/app/_layout.tsx`), caches to SQLite via `expo-sqlite/kv-store`, has timeout/fallback handling, and gracefully degrades to defaults when offline. This is the natural integration point.

**App version**: Hardcoded as `"1.0.0"` in `app.config.ts` via the `version` field. `Constants.expoConfig.version` from `expo-constants` provides runtime access. Currently unused — the Settings screen shows a hardcoded i18n string `"1.0.0"` instead.

**State management**: Consistent Zustand pattern with `create()` — no Redux or React Context. `useRemoteConfigStore` is the canonical example and closest parallel.

**API stack**: Hono on Cloudflare Workers. Environment variables bound via `Env` interface. Two middleware patterns exist: CORS config and DB injector. No request validation middleware.

**DB schema**: Postgres via Drizzle ORM (`sonora` schema prefix). Tables: `themes`, `experiences`, `waypoints`, `feedbacks`. No config or version table. Migrations are managed with `drizzle-kit`.

**i18n**: `react-i18next` with `en` and `es` locales. `useAppTranslation()` gives typed `t()` with autocomplete via `TranslationKeys` (derived from the `en` dictionary). All user-facing strings MUST go through i18n.

**Testing**: API uses Vitest (`vitest run`), mobile uses Jest with `jest-expo` preset. Store tests mock `ApiClient` and storage, use Zustand `getState()/setState()` for state inspection. Config tests use `app.request('/config')` directly.

**No existing gating mechanism**: No feature flags, no kill switch, no version enforcement anywhere.

### Affected Areas

- **`packages/shared/src/schemas/config.ts`** — Extend `RemoteConfigPayloadSchema` with version fields (`minimumVersion`, `blockOlderVersions`)
- **`packages/shared/src/index.ts`** — Re-exports (auto-updated via `export *`)
- **`apps/api/src/routes/config.ts`** — Return version fields in config payload (from env vars or static defaults)
- **`apps/api/src/index.ts`** — Add `MINIMUM_APP_VERSION`, `BLOCK_OLDER_VERSIONS` to `Env` interface (if env-based)
- **`apps/api/wrangler.toml`** — Add `[vars]` for version config defaults
- **`apps/api/src/__tests__/config.test.ts`** — Add tests for version fields
- **`apps/mobile/src/config/app-config.ts`** — Add app version reading via `Constants.expoConfig.version`
- **`apps/mobile/src/store/remote-config-store.ts`** — Add version check logic, expose `appVersionStatus` (ok/warn/block)
- **`apps/mobile/src/store/__tests__/remote-config-store.test.ts`** — Add version check tests
- **`apps/mobile/src/app/_layout.tsx`** — Integrate version check that shows block/warning UI after config loads
- **`apps/mobile/src/app/(tabs)/_layout.tsx`** — Optional: intercept navigation if blocked
- **`apps/mobile/src/i18n/locales/en.ts`** — Add version warning/blocked strings
- **`apps/mobile/src/i18n/locales/es.ts`** — Add Spanish translation
- **`apps/mobile/src/components/`** — New `UpdateRequiredModal` or `UpdateWarningBanner` component

### Approaches

1. **Extend existing config endpoint (Recommended)** — Add `appVersion` section to `RemoteConfigPayload` in shared schemas; API serves `minimumVersion` + `blockOlderVersions`; remote config store checks version on init; shows warning modal or blocks app.
   - **Pros**: Leverages existing config infrastructure (fetch, cache, timeout, merge, defaults); minimal new code; version check runs automatically at startup; works offline with cached config
   - **Cons**: Config endpoint is currently static/stateless; version config would need env vars or DB (env vars are simpler and sufficient)
   - **Effort**: Low

2. **Dedicated version endpoint** — New API route `GET /api/config/version` returning version requirements separately from general config.
   - **Pros**: Clean separation; simpler payload
   - **Cons**: Extra network call; caching logic duplication; doesn't leverage existing store pattern; two sources of truth for config
   - **Effort**: Medium

3. **API middleware-based gating** — Middleware on all API routes checks `X-App-Version` header and returns `426 Upgrade Required` when version is too old.
   - **Pros**: Server-side enforcement at the API boundary
   - **Cons**: Requires version header on every request; no client-side UX control; doesn't block local/non-API functionality; significantly more complex
   - **Effort**: High

### Recommendation

**Approach 1: Extend existing config endpoint** is the clear winner. The codebase already has a mature pattern for remote configuration that handles fetching, caching, timeout, graceful degradation, and type-safe Zod validation. Adding version fields to the existing config schema requires minimal changes across all four layers (shared → API → store → UI) and follows the established architecture.

Key design decisions:

- **Config source**: Use `[vars]` in `wrangler.toml` for defaults and `Env` interface for overrides — no DB changes needed, instantly updatable via `wrangler deploy` or env vars
- **Version comparison**: Add a `semver` utility in shared package (or use simple string comparison for semver — `compare-versions` is a lightweight option, or implement a small `gte` function to avoid a dependency)
- **Blocking UX**: Show a full-screen modal (non-dismissable when `blockOlderVersions: true`) that routes to the app/play store. For warning mode, show a dismissable banner
- **Offline behavior**: If config is cached from a previous valid session, the cached version check result can be reused (within reason). If no cache exists and offline, skip the check (app launches normally)
- **Env variables needed**: `MINIMUM_APP_VERSION` (string like "1.0.0"), `BLOCK_OLDER_VERSIONS` ("true" or "false")

### Risks

- **Offline first-launch edge case**: If a user installs an old version and has no network, they won't get the version check. Mitigation: the app works normally offline, but on next online launch the check runs. This is acceptable.
- **Semver complexity**: Version strings like "1.0.0" vs "1.0" vs "1.0.0-beta" need consistent comparison. Mitigation: use a well-tested semver comparison utility (a tiny `gte(a, b)` function or the `compare-versions` npm package — 0 dependencies, 2.5kB).
- **expo-constants version accuracy**: `Constants.expoConfig.version` reflects the `version` field in `app.config.ts`, which must be bumped on each release. Human error risk. Mitigation: enforce in CI or EAS build hooks.
- **Config cache poisoning**: An old config cache with permissive version settings could allow using a blocked version offline. Mitigation: cache the version check result alongside the config, and re-check on each online init.
- **No existing TDD for config store scenario**: The existing store tests don't cover async init behavior at the integration level. Need to add proper tests for the new version-checking paths.

### Ready for Proposal

Yes — the path is clear, the approach is well-understood, and the existing architecture supports it directly. Ready for `sdd-propose`.
