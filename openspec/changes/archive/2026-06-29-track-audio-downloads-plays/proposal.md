# Proposal: Track Audio Downloads, Plays, Usability Events, and Crashes

## Intent

Track audio download, playback metrics, user interaction events, and application crashes in the Sonora mobile application to understand engagement, behavior, network conditions, and application stability. This tracking must work offline (caching events locally and syncing when a connection is restored) and must be decoupled from the core application logic to facilitate a future migration to a self-hosted database if needed.

## Scope

### In Scope

- Integrate Firebase Analytics SDK in the mobile app.
- Integrate Firebase Crashlytics SDK to automatically track unhandled exceptions, app hangs (crashes/freezes), and fatal errors.
- Implement an `AnalyticsService` abstraction to decouple tracking logic from UI, hooks, and state stores.
- Identify users anonymously using standard Firebase App Instance IDs (retained across app updates on native iOS/Android, and persisted in browser cookies/LocalStorage on Web).
- Track audio download lifecycle events:
  - `audio_download_started` (params: `track_id`, `url`)
  - `audio_download_completed` (params: `track_id`)
  - `audio_download_failed` (params: `track_id`, `error_msg`)
- Track audio playback and interaction events:
  - `audio_play_started` (params: `track_id`)
  - `audio_play_completed` (params: `track_id`)
  - `audio_playback_failed` (params: `track_id`, `error_msg`)
  - `audio_paused` (params: `track_id`, `position_ms`)
  - `audio_seek` (params: `track_id`, `from_ms`, `to_ms`)
- Track navigation & usability events:
  - `screen_viewed` (params: `screen_name`)
  - `search_performed` (params: `query`)
- Track geofence & location-related events:
  - `geofence_triggered` (params: `experience_id`, `waypoint_id`)
  - `geofence_bypassed` (params: `experience_id`)
  - `location_permission_result` (params: `granted: boolean`)
- Track network conditions:
  - `connectivity_changed` (params: `is_online: boolean`, `type: string`)
- Automatically track standard app lifecycle events (`app_open`, backgrounding/session duration) and runtime crashes via Firebase Console dashboards.
- Rely on Firebase SDK's built-in offline database queue to handle offline event persistence and batch syncing.

### Out of Scope

- Backend database schema or route changes.
- Custom admin reporting views in the Sonora web console.
- Custom UUID generation/SecureStore implementation (relying on Firebase's standard anonymous identifiers).

## Capabilities

### New Capabilities

- `analytics-tracking`: Decoupled tracking layer utilizing Firebase Analytics and Crashlytics with automatic offline queuing.

### Modified Capabilities

None

## Approach

1. Install and configure Expo-compatible Firebase Analytics and Firebase Crashlytics dependencies.
2. Implement `src/services/analytics.ts` exposing an abstraction interface `trackEvent(eventName: string, params?: object)` and `logError(error: Error, jsErrorDetails?: string)`.
3. Update `apps/mobile/src/store/download-manager-store.ts` to log download events.
4. Update `apps/mobile/src/store/audio-player-store.ts` to log play, playback interactions, and failures.
5. Integrate navigation event logging within the main tab navigation / screen entry hooks.
6. Log geofence interactions in geolocation hooks/stores.
7. Log network transitions in the network listener/hook.
8. Wire Crashlytics to catch global unhandled promise rejections and errors in React components.

## Affected Areas

| Area                                              | Impact   | Description                                                        |
| ------------------------------------------------- | -------- | ------------------------------------------------------------------ |
| `apps/mobile/package.json`                        | Modified | Add Firebase Analytics and Crashlytics dependencies.               |
| `apps/mobile/app.json` / `app.config.ts`          | Modified | Configure Firebase plugin configuration.                           |
| `apps/mobile/src/services/analytics.ts`           | New      | Abstraction layer for event dispatching and crash reporting.       |
| `apps/mobile/src/store/download-manager-store.ts` | Modified | Dispatch download-related tracking events.                         |
| `apps/mobile/src/store/audio-player-store.ts`     | Modified | Dispatch play, player interaction tracking, and playback failures. |
| `apps/mobile/src/hooks/use-track-download.ts`     | Modified | Dispatch download validation status details.                       |

## Risks

| Risk                                             | Likelihood | Mitigation                                                                               |
| ------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------- |
| Firebase package conflicts with current Expo SDK | Low        | Use standard Expo-compatible firebase integration and verify versions.                   |
| Crashlytics requires native rebuild (prebuild)   | Medium     | Ensure correct Expo configuration is set up in `app.json` for development client builds. |

## Rollback Plan

Revert changes to stores and package dependencies, removing the initialization code from the app root.

## Dependencies

- Firebase project credentials configured for Android and iOS (`google-services.json` and `GoogleService-Info.plist`).

## Success Criteria

- [ ] Analytics events are successfully sent to Firebase when online.
- [ ] Offline events are successfully queued locally and dispatched when connection is restored.
- [ ] Codebase has no direct references to Firebase SDK outside of `analytics.ts`.
- [ ] Crashes and unhandled exceptions are caught and reported to Firebase Crashlytics.
