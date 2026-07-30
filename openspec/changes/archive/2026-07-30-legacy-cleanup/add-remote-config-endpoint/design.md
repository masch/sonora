# Design: Add Remote Config Endpoint

`GET /api/config` endpoint returning runtime-configurable app settings, plus a mobile `ConfigProvider` that fetches, caches, and merges remote values over `APP_CONFIG` defaults. Enables server-driven configuration without a release cycle.

## Quick Path

1. Create `apps/api/src/routes/config.ts` — `GET /` returns static JSON
2. Add `RemoteConfigPayload` type + Zod schema in `packages/shared/src/remote-config.ts`
3. Create `apps/mobile/src/providers/remote-config-provider.tsx` — React context with fetch/cache/merge
4. Create `apps/mobile/src/hooks/use-remote-config.ts` — context consumer hook
5. Create `apps/mobile/src/storage/config-cache.ts` + `.web.ts` — KV-store / localStorage wrapper
6. Mount route in `apps/api/src/index.ts`; wrap `<ConfigProvider>` in `_layout.tsx`

## Architecture Decisions

| Topic                    | Choice                                                 | Tradeoff                    | Rationale                                                           |
| ------------------------ | ------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------- |
| **Route pattern**        | Standalone Hono router (`config.ts`)                   | Slightly more files         | Matches `health.ts` pattern — no new conventions                    |
| **Config type location** | `@sonora/shared` package                               | Adds package dep to mobile  | Already used by mobile; single source of truth for API+mobile types |
| **Runtime validation**   | Zod `safeParse` on mobile                              | Schema dependency           | Matches `feedback.ts` pattern; catch type mismatches per spec       |
| **Provider placement**   | Wrap children immediately, async update                | Flash of default config     | Spec requires non-blocking — never delay render                     |
| **Cache storage**        | `expo-sqlite/kv-store` (native) + `localStorage` (web) | Two files                   | Follows existing `feedback-storage.ts` pattern                      |
| **Fetch primitive**      | Raw `fetch` + `AbortController`                        | Wraps 3s timeout manually   | `ApiClient` cache logic is inappropriate for special-purpose fetch  |
| **Merge strategy**       | One-level deep merge with key validation               | Simpler than recursive walk | Payload is flat objects, no nested arrays                           |

## Data Flow

```
┌──────────────┐    GET /api/config     ┌──────────────┐
│  ConfigRouter │ ◄──────────────────── │  Expo App     │
│  (no DB/auth) │ ──── JSON ──────────► │  on startup   │
└──────────────┘                        └──────┬───────┘
                                               │
                                   ┌───────────▼───────────┐
                                   │  ConfigProvider         │
                                   │                         │
                                   │  1. Read cache ───────► │
                                   │  2. Fetch with 3s timer │
                                   │  3. Validate (Zod)      │
                                   │  4. Deep-merge over     │
                                   │     APP_CONFIG defaults  │
                                   │  5. Write cache          │
                                   │  6. setState(newConfig)  │
                                   └───────────┬─────────────┘
                                               │ context
                                   ┌───────────▼─────────────┐
                                   │  useRemoteConfig()       │
                                   │  → any component         │
                                   └─────────────────────────┘
```

**Merge priority** (top wins):

1. Remote API response (per-key Zod-validated)
2. AsyncStorage cache (from prior successful fetch)
3. APP_CONFIG defaults (compile-time fallback)

## File Changes

| File                                                   | Action | Description                                                              |
| ------------------------------------------------------ | ------ | ------------------------------------------------------------------------ |
| `apps/api/src/routes/config.ts`                        | Create | `GET /` → static `RemoteConfigPayload` JSON                              |
| `apps/api/src/index.ts`                                | Modify | `import { configRouter }` + `app.route('/config', configRouter)`         |
| `packages/shared/src/remote-config.ts`                 | Create | `RemoteConfigPayload` interface + `RemoteConfigPayloadSchema` Zod schema |
| `packages/shared/src/index.ts`                         | Modify | `export * from './remote-config'`                                        |
| `apps/mobile/src/providers/remote-config-provider.tsx` | Create | React context + provider with fetch/cache/merge                          |
| `apps/mobile/src/hooks/use-remote-config.ts`           | Create | `useRemoteConfig()` → `MergedConfig`                                     |
| `apps/mobile/src/storage/config-cache.ts`              | Create | KV-store wrapper for key `"remote-config"`                               |
| `apps/mobile/src/storage/config-cache.web.ts`          | Create | `localStorage` wrapper for same key                                      |
| `apps/mobile/src/app/_layout.tsx`                      | Modify | Wrap `<ConfigProvider>` before `<Stack>`                                 |

## Interfaces / Contracts

```typescript
// packages/shared/src/remote-config.ts
import { z } from 'zod';

export const RemoteConfigPayloadSchema = z.object({
  geofence: z.object({ radiusMeters: z.number() }),
  bypassGeofence: z.boolean(),
  audio: z.object({ rewindOffsetMs: z.number() }),
  feedback: z.object({ syncIntervalSec: z.number() }),
});

export type RemoteConfigPayload = z.infer<typeof RemoteConfigPayloadSchema>;
```

```typescript
// apps/mobile/src/providers/remote-config-provider.tsx
interface ConfigContextValue {
  config: RemoteConfigPayload; // merged: defaults + cache + remote
  loading: boolean;
  error: Error | null;
}
```

```typescript
// apps/mobile/src/hooks/use-remote-config.ts
function useRemoteConfig(): RemoteConfigPayload;
```

## Provider Startup Sequence

1. APP_CONFIG loaded (compile-time `as const`)
2. `<ConfigProvider>` renders with `{ ...APP_CONFIG, ...cached }` (or just defaults if no cache)
3. `useEffect` fires async fetch: `fetch(url, { signal: AbortSignal.timeout(3000) })`
4. **Fetch succeeds**: validate via Zod → deep-merge → setState → write cache
5. **Fetch fails** (timeout / network / invalid): setState stays at current (cache or defaults), log warning
6. Children render immediately in all paths — never block

## Cache Strategy

- **Key**: `"remote-config"` (string constant)
- **Storage**: `expo-sqlite/kv-store` on native, `localStorage` on web
- **Write**: on every successful fetch (overwrite)
- **Read**: on provider mount, before fetch fires
- **TTL**: none per spec — cached config is used until a fresh fetch succeeds
- **Corruption**: `JSON.parse` wrapped in try/catch; parse failure → discard, use defaults

## Testing Strategy

| Layer              | What                                                   | How                                                     |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------- |
| API unit           | `GET /api/config` returns correct shape and types      | Vitest, Hono `app.request('/config')`, assert JSON body |
| Mobile unit        | Merge logic (partial, type mismatch), cache read/write | Vitest, mock KV store                                   |
| Mobile integration | Provider renders children, context updates on fetch    | Testing Library, mock `global.fetch`                    |
| Mobile integration | Timeout fallback uses defaults                         | Mock fetch to never resolve                             |

## Risks & Edge Cases

| Risk                                               | Mitigation                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| 3s timeout on slow networks                        | `AbortSignal.timeout(3000)`; app never blocks or hangs                        |
| API returns wrong types                            | Zod `safeParse` discards entire response; falls back to defaults              |
| Cache has stale/invalid JSON                       | try/catch on parse; falls through to defaults                                 |
| Provider re-renders unnecessarily                  | Stable context value via `useMemo`; only update on actual fetch result change |
| `@sonora/shared` not compiled before mobile import | Ensure workspace build depends on shared first (already in monorepo)          |
| No auth on endpoint = public config                | Acceptable per spec — config contains no secrets, only UX tuning values       |

## Open Questions

None — all design decisions are resolved from specs and codebase analysis.

## Migration / Rollout

No migration required. The endpoint is stateless; the mobile provider is opt-in by wrapping in layout. Existing `APP_CONFIG` values remain as-is — remote values are optional overrides.
