# Design — Play Core Startup Update Check & Analytics

**Change:** `play-core-startup-update`
**Status:** Designed
**Inputs:** proposal.md, spec.md

---

## 1. Overview & Architecture

This design hooks the existing `PlayCoreUpdateProvider.checkForUpdate()` into `UpdateService` and runs it asynchronously on Android startup inside `apps/mobile/src/app/_layout.tsx`.

When an update is detected as available from Google Play Core (`shouldUpdate: true`), `updateService.triggerUpdate({ mode: 'flexible' })` is executed (or `UpdateWarningBanner` is displayed if manual prompt is preferred).

All check lifecycles are instrumented via `AnalyticsService.trackEvent` with `source: 'startup'`.

---

## 2. Component Design

### 2.1 UpdateService Extension

- Add `checkForUpdate(): Promise<boolean>` to `UpdateProvider` interface.
- Implement in `UpdateService`:

  ```ts
  async checkForUpdate(options: CheckForUpdateOptions): Promise<boolean> {
    for (const provider of this.providers) {
      try {
        const available = await provider.isAvailable();
        if (available && provider.checkForUpdate) {
          return await provider.checkForUpdate(options);
        }
      } catch (err) {
        logger.warn(`[UpdateService] Provider ${provider.name} failed during checkForUpdate:`, err);
      }
    }
    return false;
  }
  ```

### 2.2 DeepLinkUpdateProvider Stub

- `checkForUpdate(options: CheckForUpdateOptions): Promise<boolean>` resolves to `false` (no background polling mechanism for generic store links).

### 2.3 Analytics Events

- Extend `update_check_started` to `{ source: 'startup' | 'manual' }`.
- Extend `update_check_completed` to `{ update_available: boolean; source: 'startup' | 'manual' }`.
- Update `PlayCoreUpdateProvider.checkForUpdate(options: CheckForUpdateOptions)` to pass `source`.

### 2.4 App Startup Hook (`_layout.tsx`)

- In `useEffect` on app mount:

  ```ts
  useEffect(() => {
    const remoteConfigPromise = useRemoteConfigStore.getState().init();
    void useTranslationStore.getState().init();

    AnalyticsService.trackEvent('app_open');
    void updateService.checkForInstalledUpdate();

    // Check for available updates in background
    void (async () => {
      try {
        await remoteConfigPromise;
        const hasUpdate = await updateService.checkForUpdate({ source: 'startup' });
        if (hasUpdate && useRemoteConfigStore.getState().versionStatus !== 'block') {
          await updateService.triggerUpdate({ mode: 'flexible' });
        }
      } catch (err) {
        logger.warn('[UpdateService] Startup check failed', err);
      }
    })();
  }, []);
  ```

---

## 3. Testing Strategy

- Unit test `updateService.checkForUpdate()` handling available provider returning true/false.
- Unit test fallback when provider throws or is unavailable.
- Verify analytics events emitted with expected payloads.
