# Design: Instructions as Trip

## Overview

Convert the hardcoded instructions audio (`instructions.mp3`) into a first-class Trip experience served by the Experiences API. This makes the instructions discoverable in the Derivas (trips) section, uses the existing trip semantics (waypoint, theme, JWT-signed audio URL, UUID track identifier), and removes the special-case auth bypass in the audio streaming route.

---

## Architecture

### Current State

```
┌─────────────────────────────────┐
│    HomeAudioPlayer              │
│                                 │
│  APP_CONFIG.audio.instructionsUrl ───► hardcoded URL
│                                 │     (client-key token)
│  useTrackDownload('instructions', │
│    instructionsUrl, title)       │
│                                 │
│  useImmersionPlayer('instructions')│
└─────────────────────────────────┘
```

- The instructions audio URL is built at build time in `app-config.ts` using a client-key token (not JWT)
- The audio streaming route has a **special-case bypass** for `instructions.mp3` that accepts the client key as a valid token (see `audio.ts` line ~93)
- The download track identifier is the hardcoded string `'instructions'`
- The instructions do NOT appear in the Experiences API at all

### Target State

```
┌──────────────────────────────────────┐
│              HomeAudioPlayer         │
│                                      │
│  fetchExperiences()                  │
│       │                             │
│       ▼                             │
│  find slug === 'instructions'      │
│       │                             │
│       ├── found? ──► audioUrl (JWT-signed)│
│       │              id (UUID)       │
│       │                              │
│       └── not found? ──► fallback    │
│                           instructionsUrl │
│                           'instructions'  │
│                                      │
│  useTrackDownload(uuid|'instructions',│
│    url|fallbackUrl, title)           │
│                                      │
│  useImmersionPlayer(uuid|'instructions')│
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│              API                     │
│                                      │
│  GET /experiences                    │
│    ├── instructions (trip)          │
│    │   ├── audioUrl: JWT-signed URL  │
│    │   ├── id: UUID                  │
│    │   ├── themeKey: 'onboarding'    │
│    │   ├── imageKey: 'trip-instruc..'│
│    │   └── waypoints[0]             │
│    └── ...other experiences          │
│                                      │
│  GET /audio/stream?key=...&token=... │
│    └── JWT-validated (no more bypass)│
└──────────────────────────────────────┘
```

---

## Data Flow: Audio URL Resolution

```
  HomeAudioPlayer mounts
        │
        ▼
  fetchExperiences() ───────────────► GET /api/experiences
        │                                      │
        ▼                                      ▼
  Find exp with slug='instructions'    API signs JWT for audioUrl
        │                                (key + expiry in payload)
        │
        ├── Found ──► useTrackDownload(
        │               exp.id,           ◄── UUID
        │               exp.audioUrl,      ◄── JWT-signed URL
        │               t('home.instructionsName')
        │             )
        │
        └── Not found ──► useTrackDownload(
                          'instructions',         ◄── fallback string
                          APP_CONFIG.audio.instructionsUrl, ◄── fallback URL
                          t('home.instructionsName')
                        )
                               │
                               ▼
                    DownloadManagerStore enqueue
                               │
                               ▼
                    expo-file-system download
                    (or web Cache API)
                               │
                               ▼
                    useImmersionPlayer(localAudioUri)
                               │
                               ▼
                    Audio plays
```

### Fallback Triggers

| Condition                                     | Fallback URL                       | Fallback Track ID |
| --------------------------------------------- | ---------------------------------- | ----------------- |
| API fetch error (network, server error)       | `APP_CONFIG.audio.instructionsUrl` | `'instructions'`  |
| API responds but no `slug === 'instructions'` | `APP_CONFIG.audio.instructionsUrl` | `'instructions'`  |
| API responds and trip found                   | Trip's `audioUrl` (JWT-signed)     | Trip's UUID       |

The fallback keeps `APP_CONFIG.audio.instructionsUrl` in `app-config.ts`, so if the backend change is deployed _after_ the frontend, existing installs continue working.

---

## Database Changes (Seed Data)

### New Theme: `onboarding`

Add to `defaultThemes` in `apps/api/src/db/seed.ts`:

```ts
{
  key: 'onboarding',
  labelKey: 'experiences.categories.onboarding',
  order: 4,
  applicableFormat: 'trip' as const,
}
```

No migration needed — the seed script uses `onConflictDoUpdate` with `themes.key` as the conflict target, so new themes are inserted automatically on the next seed run.

### New Experience: Instructions Trip

Add to the `defaultExperiences` array. The seed script's `onConflictDoUpdate` on `experiences.id` handles upsert:

```ts
{
  id: 'a23baa7e-2c82-472f-9241-4f23e00c1733',  // new UUID, distinct from umepay-bosque
  slug: 'instructions',
  title: 'INSTRUCTIONS',              // matches map.instructionsTitle
  description: '(cómo usar la app de Sonora)', // matches map.instructionsSub
  format: 'trip' as const,
  themeKey: 'onboarding',
  audioUrl: 'experiences/instructions.mp3',
  durationSeconds: 116,
  latitude: -32.211913,                // Sonora location (same as umepay-bosque)
  longitude: -64.73809012343702,
  free: true,
  imageKey: 'trip-instructions-cover',
  geofenceBypassable: false,           // regular trip — requires being at start
}
```

### New Waypoint

Add to `defaultWaypoints`. The seed script deletes and re-inserts waypoints only for seeded experiences:

```ts
{
  experienceId: 'a23baa7e-2c82-472f-9241-4f23e00c1733',
  order: 1,
  latitude: -32.211913,
  longitude: -64.73809012343702,
  radiusMeters: 50,
}
```

### Why `geofenceBypassable: false`?

The instructions trip is a regular trip that appears in the Derivas section. The user must be at or near the Sonora start location to begin playback, consistent with all other trips in the system. The HomeAudioPlayer component bypasses geofence checks because it uses the download + play flow directly (like `track-detail-view.tsx`), not the geofence-based flow that trips normally use from the experiences screen.

---

## Auth: Audio URL Security

### Current Auth Flow for Trip Audio URLs

1. `GET /experiences` lists all experiences
2. For each experience with an `audioUrl`, the API creates a **signed JWT**:
   - `{ key: exp.audioUrl, exp: now + AUDIO_LINK_EXPIRY_SECONDS }`
   - Signs with `JWT_SECRET` using HS256
   - Returns full URL: `/audio/stream?key={encodedUrl}&token={jwt}`
3. `GET /audio/stream` verifies the JWT, checking `payload.key === key`

### Current Special-Case Bypass for Instructions

In `audio.ts`, line ~93:

```ts
if (!isAuthorized && key === 'experiences/instructions.mp3' && token === clientKey) {
  isAuthorized = true;
}
```

This allows the hardcoded `APP_CONFIG.audio.instructionsUrl` (which uses the client key, not a JWT) to stream the instructions audio.

### After This Change

- The instructions trip gets a JWT-signed `audioUrl` from the experiences API, just like any other trip
- **The frontend will use the JWT-signed URL** (via `exp.audioUrl`), so the special-case bypass is no longer needed for the primary flow
- **However**: the fallback `APP_CONFIG.audio.instructionsUrl` still uses the client-key token, so the bypass must remain in `audio.ts` during the transition
- **Follow-up**: once the app version with API-driven URL resolution reaches all users, remove:
  - The special-case bypass in `audio.ts`
  - The `APP_CONFIG.audio.instructionsUrl` config entry

---

## Shared Package Changes

### `packages/shared/src/experiences.ts`

Add `'trip-instructions-cover'` to `TRACK_IMAGE_KEYS`:

```ts
export const TRACK_IMAGE_KEYS = [
  'trips-deriva-centro-cover',
  'tracks-texto-maga-cover',
  'tracks-pajaros-chiricotes-cover',
  'trip-instructions-cover', // ← new
] as const;
```

### `packages/shared/src/locales/en.ts`

```ts
experiences: {
  categories: {
    // ...existing keys
    onboarding: 'Onboarding',          // ← new
  },
},
```

### `packages/shared/src/locales/es.ts`

```ts
experiences: {
  categories: {
    // ...existing keys
    onboarding: 'Introducción',        // ← new
  },
},
```

### No Enum Changes

`Theme.key` and `BaseExperience.themeKey` are typed as `string` in the shared types — no enum changes are needed. The `onboarding` theme key flows naturally through the existing type system.

---

## New Hook: `useInstructionsAudio`

To encapsulate the audio URL resolution (API trip → fallback) and keep `HomeAudioPlayer` focused on playback, create a dedicated hook in `apps/mobile/src/hooks/use-instructions-audio.ts`.

### Interface

```tsx
interface UseInstructionsAudioResult {
  /** Resolved audio URL — from the API instructions trip, or APP_CONFIG fallback */
  audioUrl: string | null;
  /** Resolved track ID — the trip UUID, or 'instructions' fallback */
  trackId: string;
  /** Loading while the experiences fetch is in-flight */
  loading: boolean;
  /** Error state when both API and fallback fail */
  error: Error | null;
}

function useInstructionsAudio(): UseInstructionsAudioResult;
```

### Implementation

```tsx
export function useInstructionsAudio(): UseInstructionsAudioResult {
  const { t } = useAppTranslation();
  const [experiences, setExperiences] = useState<Experience[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    fetchExperiences(controller.signal)
      .then((data) => {
        if (!cancelled) {
          setExperiences(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
          // experiences stays null → fallback kicks in
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const instructionsTrip = useMemo(
    () => experiences?.find((exp) => exp.slug === 'instructions' && exp.format === 'trip') ?? null,
    [experiences],
  );

  return {
    audioUrl: instructionsTrip?.audioUrl ?? APP_CONFIG.audio.instructionsUrl,
    trackId: instructionsTrip?.id ?? 'instructions',
    loading,
    error: !instructionsTrip && error ? error : null,
  };
}
```

### Design Rationale

1. **Encapsulation**: The hook owns all resolution logic (fetch, find by slug, fallback). `HomeAudioPlayer` only receives the resolved values.

2. **Testability**: The hook is testable in isolation by mocking `fetchExperiences`. Component tests become simpler — just check values.

3. **Reusability**: If other components need the instructions audio URL in the future, they reuse the same hook.

4. **Consistency**: The existing codebase hooks into data concerns (`useTrackDownload`, `usePurchase`, `useNetworkStatus`). This follows the same pattern.

5. **No React Query**: The codebase doesn't use React Query. A simple `useEffect` + `useState` matches how `experiences-view.tsx` handles fetching, avoiding a new dependency.

### Behavior Matrix

| Scenario                 | audioUrl                           | trackId          | loading | error |
| ------------------------ | ---------------------------------- | ---------------- | ------- | ----- |
| API succeeds, trip found | trip's audioUrl                    | trip UUID        | false   | null  |
| API succeeds, no trip    | `APP_CONFIG.audio.instructionsUrl` | `'instructions'` | false   | null  |
| API fails                | `APP_CONFIG.audio.instructionsUrl` | `'instructions'` | false   | Error |
| API loading              | `APP_CONFIG.audio.instructionsUrl` | `'instructions'` | true    | null  |

## Mobile: HomeAudioPlayer Changes

### `apps/mobile/src/components/home-audio-player.tsx`

**Current** (line 19-23):

```tsx
const instructionsUrl = APP_CONFIG.audio.instructionsUrl;
const download = useTrackDownload('instructions', instructionsUrl, t('home.instructionsName'));
const player = useImmersionPlayer(download.localAudioUri, {
  title: t('home.instructionsName'),
  id: 'instructions',
});
```

**Target** (using the new hook):

```tsx
const { audioUrl, trackId } = useInstructionsAudio();

const download = useTrackDownload(trackId, audioUrl, t('home.instructionsName'));
const player = useImmersionPlayer(download.localAudioUri, {
  title: t('home.instructionsName'),
  id: trackId,
});
```

The component no longer imports `APP_CONFIG` or `fetchExperiences` — the hook handles all resolution logic.

### Test implications

With the hook extracted, `HomeAudioPlayer` tests no longer need to mock `fetchExperiences`. They mock `useInstructionsAudio` instead (like `useTrackDownload` is already mocked). The hook itself gets its own test file.

---

## Mobile: Image Constants Changes

### `apps/mobile/src/constants/images.ts`

Add to `TRACK_IMAGES` record:

```ts
export const TRACK_IMAGES: Record<TrackImageKey, ImageSourcePropType> = {
  // ...existing keys
  'trip-instructions-cover': require('@/assets/images/sonora/cover-instructions-1.png'),
};
```

The image already exists as `SONORA_INSTRUCTIONS_BG` — we're adding a new key that points to the same asset.

---

## Tests

### `apps/mobile/src/__tests__/home-audio-player.test.tsx`

The existing test mocks `useTrackDownload` at the module level. The component still calls `useTrackDownload` with the same interface (`trackId, audioUrl, title`), so the mock pattern remains valid. However, the test should be updated to:

1. Verify the component fetches experiences (or calls `fetchExperiences`) on mount
2. Verify that when the API is mocked to return an instructions trip, the `useTrackDownload` is called with the trip's UUID and JWT-signed URL
3. Verify that when the API mock returns an error, the fallback URL and `'instructions'` string are used

The current mock returns a fixed `{ status, progress, ... }` object. After the change, the mock should remain similar, but the test needs to:

- Mock `fetchExperiences` from `@/data/experiences`
- Control the mock return value per test case

### API Seed Data Tests

No formal seed data tests exist. The spec covers this via the seed script behavior. Manual verification steps:

1. Run `npx tsx src/db/seed.ts`
2. Query `SELECT * FROM sonora.themes WHERE key = 'onboarding'` → verify row exists
3. Query `SELECT * FROM sonora.experiences WHERE slug = 'instructions'` → verify row
4. Query `SELECT * FROM sonora.waypoints WHERE experienceId = '<uuid>'` → verify single waypoint

---

## File Change Summary

| File                                                       | Change Type | Description                                                  |
| ---------------------------------------------------------- | ----------- | ------------------------------------------------------------ |
| `packages/shared/src/experiences.ts`                       | Edit        | Add `'trip-instructions-cover'` to `TRACK_IMAGE_KEYS`        |
| `packages/shared/src/locales/en.ts`                        | Edit        | Add `experiences.categories.onboarding: 'Onboarding'`        |
| `packages/shared/src/locales/es.ts`                        | Edit        | Add `experiences.categories.onboarding: 'Introducción'`      |
| `apps/api/src/db/seed.ts`                                  | Edit        | Add `onboarding` theme, instructions trip, single waypoint   |
| `apps/mobile/src/constants/images.ts`                      | Edit        | Add `'trip-instructions-cover'` → `cover-instructions-1.png` |
| `apps/mobile/src/hooks/use-instructions-audio.ts`          | **Create**  | New hook encapsulating API URL resolution + fallback         |
| `apps/mobile/src/components/home-audio-player.tsx`         | Edit        | Use `useInstructionsAudio` hook instead of direct config URL |
| `apps/mobile/src/__tests__/use-instructions-audio.test.ts` | **Create**  | Tests for the new hook                                       |
| `apps/mobile/src/__tests__/home-audio-player.test.tsx`     | Edit        | Mock `useInstructionsAudio` instead of inline API fetch      |

### Files NOT changed

| File                                              | Reason                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/api/src/routes/audio.ts`                    | Special-case bypass kept during transition; removed in follow-up         |
| `apps/api/src/routes/experiences.ts`              | No changes needed — JWT signing works for any experience with `audioUrl` |
| `apps/mobile/src/config/app-config.ts`            | `instructionsUrl` kept as fallback; removed in follow-up                 |
| `packages/shared/src/enums.ts`                    | `Theme.key` and `themeKey` are `string` type — no enum needed            |
| `apps/mobile/src/data/experiences.ts`             | No new helper needed — `useInstructionsAudio` hook handles it            |
| `apps/mobile/src/components/experiences-view.tsx` | The instructions trip appears automatically via existing listing logic   |
| `apps/mobile/src/components/track-map.tsx`        | The existing `SONORA_INSTRUCTIONS_BG` import is unchanged                |

---

## Deploy Order

```
1. Backend (seed data) ───► 2. Frontend (HomeAudioPlayer)
```

The fallback mechanism ensures no breakage if the frontend is deployed before the backend sees the new seed data. However, to get the full benefit (JWT-signed URL, no bypass needed), deploy the backend first.

### Rollback

- **Single commit revert**: reverting the seed data and HomeAudioPlayer change restores the hardcoded URL
- **Backend only rolled back**: frontend falls back to `APP_CONFIG.audio.instructionsUrl` automatically
- **Frontend only rolled back**: backend still has the new theme and experience row (harmless data)

---

## Risks

| Risk                                                                                                 | Likelihood | Mitigation                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cache invalidation**: track ID changes from `'instructions'` to the trip UUID, causing re-download | Medium     | Acceptable one-time cost. Old cached file can be cleaned up via `deleteTrackLocal` in a post-update migration hook, or left for the user to naturally clear.                       |
| **API dependency for HomeAudioPlayer**: currently works fully offline                                | Low        | Fallback URL preserves offline behavior if API is unreachable                                                                                                                      |
| **Race condition**: API response arrives after user presses play                                     | Low        | `useTrackDownload` handles `trackId` being `'instructions'` initially, then switching to UUID on re-render. The download won't re-start for the same trackId if already completed. |
| **Test mock divergence**: existing test mocks need update                                            | Low        | Straightforward — mock `fetchExperiences` and update assertions                                                                                                                    |

---

## Follow-up Tasks (Post-Deployment)

1. **Remove** the special-case auth bypass in `apps/api/src/routes/audio.ts` (the `key === 'experiences/instructions.mp3' && token === clientKey` check)
2. **Remove** `APP_CONFIG.audio.instructionsUrl` from `apps/mobile/src/config/app-config.ts`
3. **Clean up** old cached instructions download file (trackId `'instructions'`) from device storage
