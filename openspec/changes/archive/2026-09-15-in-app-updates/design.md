# Design: In-App Updates

## Technical Approach

Implement a resilient, decoupled store update mechanism in `apps/mobile` following the Strategy Pattern with Graceful Degradation.
The architecture separates platform-specific URI resolution (`store-url.ts`), update strategy execution (`update-service.ts`), and user interface presentation (`UpdateRequiredModal`, `UpdateWarningBanner`).

In Phase 1, the default strategy is `DeepLinkUpdateProvider`, ensuring immediate, error-free platform store redirection.
In Phase 2, `PlayCoreUpdateProvider` is registered as the primary Android strategy with automatic fallback to `DeepLinkUpdateProvider`.

## Architecture Decisions

| Decision             | Choice                                                    | Alternatives Considered                           | Rationale                                                                                                                                                         |
| -------------------- | --------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pattern**          | Strategy Pattern with Fallback                            | Hardcoded `Linking.openURL()` calls in components | Decouples UI components from store APIs and enables pluggable native drivers without touching UI code.                                                            |
| **Store Resolution** | Platform-specific URI with fallback (`market://` → HTTPS) | Only HTTPS web link                               | `market://` launches the native Google Play Store app directly, bypassing browser picker dialogs. HTTPS provides safety for devices without Play Store installed. |
| **UI Integration**   | Wire into existing `versionStatus` modals/banners         | Separate update screen                            | Reuses the battle-tested `app-version-check` and `remote-config-store` contracts without duplicate screens.                                                       |
| **Phased Delivery**  | Phase 1 (Deep Link Abstraction) → Phase 2 (Play Core)     | Monolithic native build                           | Prevents native dependency breakages in development and CI; delivers immediate production value.                                                                  |

## Data Flow

```
[User Clicks "Update" on Modal or Banner]
                   │
                   ▼
       UpdateService.triggerUpdate({ mode })
                   │
                   ▼
       Is Native Play Core available?
         ├── YES (Android Play Store install)
         │     │
         │     ▼
         │   Execute Play Core In-App Update flow
         │     ├── Success ──→ Complete in-app
         │     └── Failure ──┐
         │                   │ (Graceful Fallback)
         └── NO / iOS / Web ─┘
                   │
                   ▼
       Resolve Platform Store URLs
         ├── Android: market://details?id=<package> (fallback: https://play.google...)
         ├── iOS: itms-apps:// or https://apps.apple.com/app/id<appId>
         └── Web: Default web URL
                   │
                   ▼
         Linking.openURL(storeUrl)
```

## File Changes

| File                                                                  | Action | Description                                                                          |
| --------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| `apps/mobile/src/services/store-url.ts`                               | Create | Resolves primary and fallback URLs for Android, iOS, and Web                         |
| `apps/mobile/src/services/update-service.ts`                          | Create | Provider interface, `DeepLinkUpdateProvider`, and `UpdateService` orchestrator       |
| `apps/mobile/src/services/__tests__/store-url.test.ts`                | Create | Unit tests covering Android, iOS, and Web platform resolution                        |
| `apps/mobile/src/services/__tests__/update-service.test.ts`           | Create | Unit tests verifying strategy execution and fallback triggers                        |
| `apps/mobile/src/components/update-required-modal.tsx`                | Modify | Delegate update button press to `updateService.triggerUpdate({ mode: 'immediate' })` |
| `apps/mobile/src/components/update-warning-banner.tsx`                | Modify | Add "Update" action triggering `updateService.triggerUpdate({ mode: 'flexible' })`   |
| `apps/mobile/src/components/__tests__/update-required-modal.test.tsx` | Modify | Assert `updateService.triggerUpdate` invocation                                      |
| `apps/mobile/src/components/__tests__/update-warning-banner.test.tsx` | Modify | Assert update button render and trigger                                              |
| `apps/mobile/src/i18n/locales/en.ts` & `es.ts`                        | Modify | Add `versionCheck.bannerUpdate` string                                               |
