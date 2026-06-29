# Design: Track Audio Downloads, Plays, Usability Events, and Crashes

## Technical Approach

We will integrate Firebase Analytics and Firebase Crashlytics via an abstraction service (`AnalyticsService`) to log audio download, playback, navigation, geofence, network, and crash events.

## Architecture Decisions

| Option                               | Tradeoff                                                                                  | Decision                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Decoupled `AnalyticsService` wrapper | Introduces a helper service, but completely isolates the Firebase SDK dependencies.       | **Chosen**. Isolates all `@react-native-firebase` imports.      |
| Firebase App Instance ID             | Simple, robust, persists through app updates, but changes if the app is uninstalled.      | **Chosen**. Avoids custom local storage/UUID logic.             |
| Firebase Crashlytics integration     | Requires native config plugins, but provides out-of-the-box unhandled exception catching. | **Chosen**. Wire up automatically using the Expo config plugin. |

## Data Flow

```
   [Components/Stores] ──(events/errors)──→ [AnalyticsService]
                                                   │
                            ┌──────────────────────┴──────────────────────┐
                            ▼                                             ▼
                 [Firebase Analytics]                            [Firebase Crashlytics]
              (Offline Queue -> Batch Sync)                   (Immediate / Next-Launch Send)
```

## File Changes

| File                                              | Action | Description                                            |
| ------------------------------------------------- | ------ | ------------------------------------------------------ |
| `apps/mobile/package.json`                        | Modify | Add Firebase dependencies.                             |
| `apps/mobile/app.config.ts`                       | Modify | Add Firebase native config plugins.                    |
| `apps/mobile/src/services/analytics.ts`           | Create | Expose `trackEvent` and `recordError` wrapper.         |
| `apps/mobile/src/store/download-manager-store.ts` | Modify | Log download lifecycle events.                         |
| `apps/mobile/src/store/audio-player-store.ts`     | Modify | Log playback lifecycle, interaction, and error events. |

## Interfaces / Contracts

```typescript
// src/services/analytics.ts
export interface AnalyticsInterface {
  trackEvent(eventName: string, params?: Record<string, any>): void;
  recordError(error: Error, customDescription?: string): void;
}
```

## Testing Strategy

| Layer       | What to Test               | Approach                                                                     |
| ----------- | -------------------------- | ---------------------------------------------------------------------------- |
| Unit        | `AnalyticsService` routing | Mock Firebase SDK and verify `trackEvent` passes events correctly.           |
| Integration | Store integration          | Verify `download-manager-store` and `audio-player-store` invoke the service. |

## Migration / Rollout

No database migration is required.
