# SDD Proposal: Instructions as Trip

## 1. Intent

Convert the hardcoded instructions audio asset (`instructions.mp3`) into a first-class Trip experience served by the Experiences API. This makes the instructions discoverable through the app's existing Derivas (trips) section, establishes a single source of truth for its audio URL, and removes the special-case config entry `APP_CONFIG.audio.instructionsUrl`.

## 2. Scope

### In Scope

**Backend (`apps/api`)**

- Add a new experience row to the seed data (and corresponding migration) with:
  - `slug: 'instructions'`
  - `format: 'trip'`
  - `audioUrl: 'experiences/instructions.mp3'`
  - A single waypoint at the Sonora location (matching the existing trip's coordinates)
  - Duration matching the actual instructions audio file length
  - `themeKey: 'onboarding'` (new theme)
  - `imageKey: 'trip-instructions-cover'` (new key pointing to existing `cover-instructions-1.png`)
  - `free: true`, `geofenceBypassable: false` (regular trip geofence — requires being at start location)
- Ensure the existing client-key auth bypass for `experiences/instructions.mp3` in `audio.ts` remains or is made redundant by JWT token auth from the experience flow

**Frontend (`apps/mobile`)**

- **`HomeAudioPlayer`**: replace the hardcoded `APP_CONFIG.audio.instructionsUrl` source with data fetched from the Experiences API:
  - On mount / when the component becomes visible, fetch experiences (or use a cached list)
  - Find the experience with `slug: 'instructions'`
  - Use its `audioUrl` as the download source for `useTrackDownload`
  - Use its `id` (UUID) as the download track identifier instead of the hardcoded `'instructions'` string
- **`app-config.ts`**: keep `APP_CONFIG.audio.instructionsUrl` as fallback. If the API fetch fails or the instructions trip is not found, fall back to the hardcoded URL
- The instructions trip will naturally appear in the Derivas (trips) list via the existing `ExperiencesScreen` (`experiences-view.tsx`) — **no UI changes needed there**

**Tests**

- Update `home-audio-player.test.tsx` mocks to account for the new API-driven URL resolution
- Add backend seed-data tests if they don't already cover new experiences
- Verify the instructions experience appears in the trips API response

### Out of Scope (Explicit Non-Goals)

- No changes to `HomeAudioPlayer` UI, layout, colors, or playback behavior
- No changes to the global player, navigation, or the way trips/tracks are listed
- No changes to the existing `experiences-view.tsx` component used by the Derivas section
- No changes to i18n translation keys for the instructions card
- No removal of the existing instructions background image asset (`SONORA_INSTRUCTIONS_BG`) — it may still be referenced elsewhere (track-map component)

## 3. Affected Areas

| Area                                                   | Impact                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `apps/api/src/db/seed.ts`                              | Add new trip experience + waypoint                                         |
| `apps/api/src/db/schema.ts`                            | Possibly a new theme entry if a dedicated theme is desired                 |
| `apps/api/src/routes/audio.ts`                         | Possibly simplify the `instructions.mp3` auth bypass if JWT auth covers it |
| `apps/mobile/src/config/app-config.ts`                 | Remove `audio.instructionsUrl`                                             |
| `apps/mobile/src/components/home-audio-player.tsx`     | Fetch experiences API, resolve instructions trip by slug                   |
| `apps/mobile/src/data/experiences.ts`                  | Possibly add a `fetchExperienceBySlug` helper or reuse existing            |
| `apps/mobile/src/__tests__/home-audio-player.test.tsx` | Update mocks to include API response                                       |
| `packages/shared/src/experiences.ts`                   | Add `'trip-instructions-cover'` to `TRACK_IMAGE_KEYS`                      |
| `packages/shared/src/enums.ts`                         | Add `'onboarding'` theme key                                               |
| `apps/api/src/db/schema.ts`                            | Add `'onboarding'` theme to themes table                                   |

## 4. Risks

| Risk                                                                                                                                                                                | Likelihood                                                 | Mitigation                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **API dependency for HomeAudioPlayer**: currently `HomeAudioPlayer` works offline with a hardcoded URL; after the change it needs the API to resolve the audio URL                  | Low (the app already fetches experiences on other screens) | Fall back to `APP_CONFIG.audio.instructionsUrl` if the fetch fails or the trip is not found.                                               |
| **Download cache invalidation**: the download track ID changes from `'instructions'` to the experience UUID, which could cause a re-download of the audio file on existing installs | Medium                                                     | Acceptable one-time cost; the old cached file can be cleaned up if needed.                                                                 |
| **Waypoint geofence**: trips normally require being within a waypoint radius to play. Instructions should NOT require geofence proximity.                                           | Low                                                        | Use `geofenceBypassable: true` on the experience, and `HomeAudioPlayer` already uses the download/play flow (not geofence-based playback). |
| **Existing test mock patterns**: `useTrackDownload` is currently mocked with a simple string `'instructions'` as track ID; changing this may require updating test infrastructure   | Low                                                        | Straightforward mock update.                                                                                                               |

## 5. Rollback Plan

**Revert commit**: A single commit reverting both the seed data addition and the `HomeAudioPlayer` changes restores the hardcoded URL behavior.

**If the API change is deployed but the frontend isn't**: No breakage — the old code ignores the new experience entry.

**If the frontend change is deployed but the API isn't**: `HomeAudioPlayer` will fail to find the instructions trip in the API response. Mitigation: keep `APP_CONFIG.audio.instructionsUrl` as a fallback during a transition window, or ensure the backend change is deployed first.

**Recommended deployment order**: Backend (seed data + migration) → Frontend (HomeAudioPlayer change).

## 6. Success Criteria

1. The `GET /experiences` endpoint returns a trip with `slug: 'instructions'`, containing one waypoint with the instructions audio URL.
2. `HomeAudioPlayer` uses the API-provided URL (not `APP_CONFIG.audio.instructionsUrl`) to download and play the instructions audio.
3. The instructions trip appears in the Derivas section alongside other trips with correct metadata (title, description, duration).
4. All existing `HomeAudioPlayer` tests pass with the new API-driven flow.
5. The instructions audio plays correctly (same behavior as before).
6. No regression in any other trips/tracks display or playback.

## 7. Questions for the User

Before finalizing the proposal, I'd like to clarify the following:

1. **Theme**: What theme should the instructions trip use? The existing themes are `birds` (tracks), `landscapes` (trips), and `community` (tracks). Should we assign it to `landscapes` (the only trip-compatible theme) or create a new theme like `instructions` or `onboarding`?

2. **Image key**: The trip needs an `imageKey` for its card in the trips list. The existing `TRACK_IMAGE_KEYS` in shared includes `'trips-deriva-centro-cover'`, `'tracks-texto-maga-cover'`, `'tracks-pajaros-chiricotes-cover'`. Should we add a new key like `'trip-instructions-cover'` (pointing to the existing `cover-instructions-1.png` asset), or reuse one of the existing keys?

3. **Duration**: Do you know the actual duration of `instructions.mp3` so I can set `durationSeconds` accurately in the seed data?

4. **Geofence bypass**: The instructions trip should bypass geofence (playable from anywhere, like tracks with `geofenceBypassable: true`). Does that match your intent?

5. **Transition strategy**: Should we keep `APP_CONFIG.audio.instructionsUrl` as a fallback for one release cycle, or remove it immediately once the backend change is deployed? This affects whether the frontend change can be deployed independently.
