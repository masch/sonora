# Design: App Version Check

## Technical Approach

Extend the existing `GET /api/config` pipeline end-to-end. API reads 3 env vars (`MINIMUM_APP_VERSION`, `BLOCK_OLDER_VERSIONS`, `GRACE_PERIOD_DAYS`) into a new `appVersion` object in the config payload. Shared Zod schema validates fields with safe gate-off defaults. `useRemoteConfigStore` computes `versionStatus: 'ok' | 'warn' | 'block'` after each config merge by comparing `Constants.expoConfig.version` against `minimumVersion` using a 20-line inline `gte()`. Root layout subscribes to `versionStatus`: `'ok'` renders nothing, `'warn'` renders a dismissable `UpdateWarningBanner`, `'block'` renders a full-screen non-dismissable `UpdateRequiredModal`. Grace period tracks first-block timestamp via the existing `expo-sqlite/kv-store` — within the window, block downgrades to warn.

## Architecture Decisions

### Decision: appVersion as nested object in existing config

| Option                                                   | Tradeoff                                                        | Decision                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| New nested `appVersion` section in `RemoteConfigPayload` | Reuses existing merge/cache/validation pipeline without changes | **Chosen** — the per-field Zod iteration in `mergeRemoteConfig` handles it automatically |
| Flat fields at config root                               | Would break existing shape contracts, require schema migration  | Rejected                                                                                 |
| Separate API endpoint                                    | Extra network call, duplicate caching, two-config problem       | Rejected                                                                                 |

### Decision: Inline semver gte() with zero dependencies

| Option                                                | Tradeoff                                                                | Decision   |
| ----------------------------------------------------- | ----------------------------------------------------------------------- | ---------- |
| `packages/shared/src/semver.ts` — 20-line `gte(a, b)` | Only needs `>=` comparison, not full semver spec; invalid → null → `ok` | **Chosen** |
| `compare-versions` npm package                        | 0 dependencies but still an external dep with build overhead            | Rejected   |
| Simple string compare                                 | Breaks on `"1.10.0"` vs `"1.9.0"`                                       | Rejected   |

### Decision: computed versionStatus in store (not a selector)

| Option                                                     | Tradeoff                                                 | Decision   |
| ---------------------------------------------------------- | -------------------------------------------------------- | ---------- |
| Computed inside `loadConfig()` and stored in Zustand state | Single source of truth, layout reads a primitive         | **Chosen** |
| Memoized selector/hook                                     | Extra hooking, re-computation risk, two sources of truth | Rejected   |

### Decision: Grace period via expo-sqlite/kv-store

| Option                                                              | Tradeoff                                                   | Decision   |
| ------------------------------------------------------------------- | ---------------------------------------------------------- | ---------- |
| Same `SqliteStorage` as config-cache, new key `version-grace-start` | Survives restarts, same storage primitive already imported | **Chosen** |
| AsyncStorage                                                        | Extra dep, different storage backend                       | Rejected   |
| In-memory only                                                      | Lost on app kill (acceptable but weaker)                   | Rejected   |

## Data Flow

```
Env vars ──→ API config route ──→ GET /api/config { appVersion }
                   │
         Zod validation in shared/schemas
                   │
    useRemoteConfigStore.loadConfig()
         │                  │
    Cache read         API response
         │                  │
    mergeRemoteConfig ←─────┘
         │
    computeVersionStatus()
    (gte + grace period)
         │
    set({ versionStatus })
         │
    _layout.tsx subscribes
         │
    ┌────┴────────────┐
    │                 │
   'ok'             'warn'/'block'
    │                 │
   nada          Modal or Banner
```

## File Changes

| File                                                                  | Action | Description                                                                       |
| --------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| `packages/shared/src/schemas/config.ts`                               | Modify | Add `appVersion` section to schema + default                                      |
| `packages/shared/src/semver.ts`                                       | Create | `gte(a, b): boolean \| null` semver comparator                                    |
| `packages/shared/src/index.ts`                                        | Modify | Re-export semver from barrel                                                      |
| `packages/shared/src/__tests__/semver.test.ts`                        | Create | Unit tests for gte                                                                |
| `packages/shared/src/__tests__/config.test.ts`                        | Modify | Test appVersion schema parsing                                                    |
| `apps/api/src/index.ts`                                               | Modify | Add `MINIMUM_APP_VERSION`, `BLOCK_OLDER_VERSIONS`, `GRACE_PERIOD_DAYS` to `Env`   |
| `apps/api/src/routes/config.ts`                                       | Modify | Read env vars, construct and return `appVersion` object                           |
| `apps/api/wrangler.toml`                                              | Modify | Add `[vars]` defaults for version env vars                                        |
| `apps/api/src/__tests__/config.test.ts`                               | Modify | Assert appVersion in response body                                                |
| `apps/mobile/src/storage/config-cache.ts`                             | Modify | Add `getGracePeriodStart()` / `setGracePeriodStart()` / `clearGracePeriodStart()` |
| `apps/mobile/src/store/remote-config-store.ts`                        | Modify | Add `versionStatus` state, compute in `loadConfig()`                              |
| `apps/mobile/src/store/__tests__/remote-config-store.test.ts`         | Modify | Test version check scenarios (ok/warn/block/grace)                                |
| `apps/mobile/src/components/update-required-modal.tsx`                | Create | Full-screen centered modal, non-dismissable                                       |
| `apps/mobile/src/components/update-warning-banner.tsx`                | Create | Dismissable top banner                                                            |
| `apps/mobile/src/components/__tests__/update-required-modal.test.tsx` | Create | Render + accessibility tests                                                      |
| `apps/mobile/src/components/__tests__/update-warning-banner.test.tsx` | Create | Render + dismiss interaction tests                                                |
| `apps/mobile/src/app/_layout.tsx`                                     | Modify | Subscribe to `versionStatus`, render modal/banner                                 |
| `apps/mobile/src/i18n/locales/en.ts`                                  | Modify | Add `versionCheck.*` strings                                                      |
| `apps/mobile/src/i18n/locales/es.ts`                                  | Modify | Add ES translations                                                               |

## Interfaces / Contracts

```typescript
// ── packages/shared/src/semver.ts ──
export function gte(a: string, b: string): boolean | null;
// null means one or both versions are invalid

// ── packages/shared/src/schemas/config.ts ──
export const RemoteConfigAppVersionSchema = z.object({
  minimumVersion: z.string().min(1).default("0.0.0"),
  blockOlderVersions: z.boolean().default(false),
  gracePeriodDays: z.number().int().min(0).default(0),
});

export const DEFAULT_REMOTE_CONFIG = {
  geofence: { … },
  audio: { … },
  feedback: { … },
  appVersion: {
    minimumVersion: "0.0.0",
    blockOlderVersions: false,
    gracePeriodDays: 0,
  },
};

// ── apps/mobile/src/store/remote-config-store.ts ──
type VersionStatus = 'ok' | 'warn' | 'block';

interface RemoteConfigState {
  config: RemoteConfigPayload;
  isLoading: boolean;
  error: Error | null;
  versionStatus: VersionStatus;
  init: () => Promise<void>;
  refetch: () => void;
}

// ── apps/mobile/src/storage/config-cache.ts ──
export function getGracePeriodStart(): Promise<number | null>;
export function setGracePeriodStart(ts: number): Promise<void>;
export function clearGracePeriodStart(): Promise<void>;
```

## Testing Strategy

| Layer       | What to Test         | Approach                                                                                               |
| ----------- | -------------------- | ------------------------------------------------------------------------------------------------------ |
| Unit        | `gte()`              | Valid semver (1.0.0 >= 1.0.0), edge cases (1.10.0 > 1.9.0), invalid versions ("abc", "") → null        |
| Unit        | Schema               | appVersion parses correctly, rejects non-string minimumVersion, rejects non-boolean blockOlderVersions |
| Integration | API config route     | Returns appVersion fields with env var values; falls back to defaults when env unset                   |
| Integration | Store version check  | Mock API + cache. Test ok/warn/block scenarios, grace period first-block vs expired                    |
| Integration | Offline first-launch | No cache + API fail → versionStatus stays 'ok'                                                         |
| Component   | UpdateRequiredModal  | Full-screen overlay renders, accessibility labels, non-dismissable                                     |
| Component   | UpdateWarningBanner  | Renders when warned, dismisses on tap, accessibile                                                     |

## Migration / Rollout

No migration required. Default values (`minimumVersion: "0.0.0"`, `blockOlderVersions: false`) keep the gate off by default. Deploy API first (adds `appVersion` to response), then deploy mobile. Old mobile clients ignore unknown keys; old API responses missing `appVersion` fill with defaults via the store.

- **Soft rollback**: Set `BLOCK_OLDER_VERSIONS=false` or lower `MINIMUM_APP_VERSION` in API env → instant deploy.
- **Hard rollback**: Revert all changed files.

## Open Questions

None.
