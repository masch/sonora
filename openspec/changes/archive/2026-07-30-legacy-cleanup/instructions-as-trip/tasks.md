# Tasks: Instructions as Trip

## Review Workload Forecast

| Field                   | Value     |
| ----------------------- | --------- |
| Estimated changed lines | ~170      |
| 400-line budget risk    | Low       |
| Chained PRs recommended | No        |
| Suggested split         | single PR |
| Delivery strategy       | single-pr |
| Chain strategy          | pending   |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

## Implementation Tasks

### Work Unit 1: Shared Package — Image Key & Locales

<details>
<summary>Dependency chain: shared → backend + mobile. No runtime deps.</summary>

These changes are purely additive and have zero runtime impact until other parts consume them. Deploy first to unblock both backend and mobile work.
</details>

- [ ] Add `'trip-instructions-cover'` to the `TRACK_IMAGE_KEYS` array in `packages/shared/src/experiences.ts`. <!-- sdd-owner: implementation -->
- [ ] Add `onboarding: 'Onboarding'` under `experiences.categories` in `packages/shared/src/locales/en.ts`. <!-- sdd-owner: implementation -->
- [ ] Add `onboarding: 'Introducción'` under `experiences.categories` in `packages/shared/src/locales/es.ts`. <!-- sdd-owner: implementation -->

**Verification**: `TRACK_IMAGE_KEYS` includes the new key; `import { TRACK_IMAGE_KEYS } from '@sonora/shared'` compiles.

---

### Work Unit 2: Backend — Seed Data (Theme, Experience, Waypoint)

<details>
<summary>Depends on: Work Unit 1 (no actual TS dependency, but conceptually the onboarding theme key should be recognized).</summary>

Once seeded, the `GET /experiences` endpoint will return the instructions trip with a JWT-signed audio URL.
</details>

- [ ] Add `onboarding` theme object to `defaultThemes` in `apps/api/src/db/seed.ts` — key=`onboarding`, labelKey=`experiences.categories.onboarding`, order=4, applicableFormat=`trip`. <!-- sdd-owner: implementation -->
- [ ] Add instructions trip experience object to the `trips` array in `apps/api/src/db/seed.ts` — slug=`instructions`, format=`trip`, themeKey=`onboarding`, audioUrl=`experiences/instructions.mp3`, durationSeconds=116, lat=-32.211913, lng=-64.73809012343702, free=true, imageKey=`trip-instructions-cover`, geofenceBypassable=false, id=`a23baa7e-2c82-472f-9241-4f23e00c1733`. <!-- sdd-owner: implementation -->
- [ ] Add single waypoint for the instructions experience to `defaultWaypoints` in `apps/api/src/db/seed.ts` — experienceId matching the new trip UUID, order=1, lat=-32.211913, lng=-64.73809012343702, radiusMeters=50. <!-- sdd-owner: implementation -->

**Verification**: Run `npx tsx src/db/seed.ts` then query:

- `SELECT * FROM sonora.themes WHERE key = 'onboarding'` → 1 row
- `SELECT * FROM sonora.experiences WHERE slug = 'instructions'` → 1 row
- `SELECT * FROM sonora.waypoints WHERE experienceId = '<uuid>'` → 1 row with radiusMeters=50

---

### Work Unit 3: Mobile — Image Constant

<details>
<summary>Depends on: Work Unit 1 (TRACK_IMAGE_KEYS). The asset file already exists.</summary>

Maps the new `TrackImageKey` to the existing `cover-instructions-1.png` asset.
</details>

- [ ] Add `'trip-instructions-cover': require('@/assets/images/sonora/cover-instructions-1.png')` to the `TRACK_IMAGES` record in `apps/mobile/src/constants/images.ts`. <!-- sdd-owner: implementation -->

**Verification**: `TRACK_IMAGES['trip-instructions-cover']` resolves to the existing asset (the same file as `SONORA_INSTRUCTIONS_BG`).

---

### Work Unit 4: Mobile — `useInstructionsAudio` Hook

<details>
<summary>Depends on: Work Unit 1 (type). New file, no existing code changed.</summary>

Encapsulates the API URL resolution with fallback logic.
</details>

- [ ] Create `apps/mobile/src/hooks/use-instructions-audio.ts` with the `useInstructionsAudio` hook that:
  - Calls `fetchExperiences()` on mount (with abort controller + cancellation flag)
  - Finds the experience with `slug === 'instructions'` and `format === 'trip'`
  - Returns `{ audioUrl, trackId, loading, error }` where `audioUrl` and `trackId` fall back to `APP_CONFIG.audio.instructionsUrl` / `'instructions'` when the API fails or the trip is not found
  - Exposes `loading: true` while the fetch is in-flight (fallback URL used during loading)
  - Exposes `error: Error | null` only when both API and fallback are unreachable (i.e. no trip found AND fetch errored) <!-- sdd-owner: implementation -->

**Verification**: Hook compiles; imports `fetchExperiences` from `@/data/experiences` and `APP_CONFIG` from `@/config/app-config`. Follows existing patterns (`useCurrentExperience.ts` for similar fetch-on-mount + find pattern).

---

### Work Unit 5: Mobile — Update `HomeAudioPlayer`

<details>
<summary>Depends on: Work Unit 4 (hook must exist). Replaces hardcoded URL with hook values.</summary>

Surgical change — replaces the import + inline const with the hook call. No UI changes.
</details>

- [ ] Replace the hardcoded `instructionsUrl` + `useTrackDownload('instructions', ...)` + `useImmersionPlayer(..., { id: 'instructions' })` in `apps/mobile/src/components/home-audio-player.tsx` with the `useInstructionsAudio()` hook:
  - Add import for `useInstructionsAudio` from `@/hooks/use-instructions-audio`
  - Destructure `{ audioUrl, trackId }` from the hook
  - Pass `trackId` and `audioUrl` to `useTrackDownload`
  - Pass `trackId` as the player `id` to `useImmersionPlayer`
  - Remove the direct `import { APP_CONFIG } from '@/config/app-config'` if no longer needed
  - Remove the direct `import { fetchExperiences } from '@/data/experiences'` (verify it's not used elsewhere in the component) <!-- sdd-owner: implementation -->

**Verification**: Component renders and functions identically. The download and player receive the resolved trackId and audioUrl from the hook.

---

### Work Unit 6: Mobile — Test `useInstructionsAudio` Hook

<details>
<summary>Depends on: Work Unit 4 (hook exists). New test file.</summary>

Tests the hook's behavior matrix in isolation.
</details>

- [ ] Create `apps/mobile/src/__tests__/use-instructions-audio.test.ts` covering:
  - Loading state on mount (returns loading=true, fallback URL, fallback trackId)
  - API success with instructions trip found (returns trip's audioUrl, trip's UUID as trackId)
  - API success with no instructions trip (returns fallback URL, `'instructions'` trackId)
  - API fetch error (returns fallback URL, `'instructions'` trackId, error object)
  - Cleanup on unmount (abort called, no setState after unmount)

  Mock `fetchExperiences` from `@/data/experiences` and `APP_CONFIG` from `@/config/app-config`. Use `renderHook` from `@testing-library/react-native` or `@testing-library/react-hooks` matching the project's existing pattern. <!-- sdd-owner: implementation -->

**Verification**: All four scenarios pass. Loading state is tested. Error state is tested. Fallback behavior is tested.

---

### Work Unit 7: Mobile — Update `HomeAudioPlayer` Tests

<details>
<summary>Depends on: Work Unit 5 (component changed). Updates existing test mocks.</summary>

Adds `useInstructionsAudio` mock; no behavioral test changes needed for the existing cases.
</details>

- [ ] Add `jest.mock('@/hooks/use-instructions-audio', ...)` to `apps/mobile/src/__tests__/home-audio-player.test.tsx` that returns controllable `{ audioUrl, trackId, loading, error }` values. <!-- sdd-owner: implementation -->

**Verification**: All existing tests pass after adding the mock. Remove the old mock for `fetchExperiences` and `APP_CONFIG` if they were mocked — they are no longer imported by the component.

---

### Post-Apply Bounded Review

- [ ] Start or reuse bounded review for the full change set. <!-- sdd-owner: parent -->
