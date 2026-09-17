import { Platform, NativeModules } from 'react-native';
import type { UpdateOptions, UpdateProvider } from './update-service';
import type SpInAppUpdates from 'sp-react-native-in-app-updates';
import type { StatusUpdateEvent } from 'sp-react-native-in-app-updates';
import { AnalyticsService } from './analytics';

// Dynamic load: sp-react-native-in-app-updates references native modules at require time.
// Deferred until after isAvailable() confirms native support to prevent Expo Go crashes.
let SpInAppUpdatesModule: (new (isDebug: boolean) => SpInAppUpdates) | null = null;
let IAUUpdateKindEnum: Record<string, number> = {
  FLEXIBLE: 0,
  IMMEDIATE: 1,
};
let IAUInstallStatusEnum: Record<string, number> = {
  DOWNLOADED: 11,
  FAILED: 5,
  CANCELED: 6,
};

function getSpInAppUpdatesClass(): (new (isDebug: boolean) => SpInAppUpdates) | null {
  if (!SpInAppUpdatesModule) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('sp-react-native-in-app-updates');
      SpInAppUpdatesModule = (mod.default || mod) as unknown as new (
        isDebug: boolean,
      ) => SpInAppUpdates;
      if (mod.IAUUpdateKind) {
        IAUUpdateKindEnum = mod.IAUUpdateKind;
      }
      if (mod.IAUInstallStatus) {
        IAUInstallStatusEnum = mod.IAUInstallStatus;
      }
    } catch {
      SpInAppUpdatesModule = null;
    }
  }
  return SpInAppUpdatesModule;
}

/**
 * Native Google Play Core update provider for Android.
 * Coordinates flexible and immediate in-app updates directly within the app.
 */
export class PlayCoreUpdateProvider implements UpdateProvider {
  name = 'play-core';
  private inAppUpdates: SpInAppUpdates | null = null;

  private getClient(): SpInAppUpdates {
    if (!this.inAppUpdates) {
      const InAppClass = getSpInAppUpdatesClass();
      if (!InAppClass) {
        throw new Error('sp-react-native-in-app-updates module not available');
      }
      this.inAppUpdates = new InAppClass(false);
    }
    return this.inAppUpdates;
  }

  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    if (!NativeModules.SpInAppUpdates) {
      return false;
    }
    return !!getSpInAppUpdatesClass();
  }

  async checkForUpdate(): Promise<boolean> {
    AnalyticsService.trackEvent('update_check_started', undefined);
    const client = this.getClient();
    const result = await client.checkNeedsUpdate();
    AnalyticsService.trackEvent('update_check_completed', {
      update_available: result.shouldUpdate,
    });
    return result.shouldUpdate;
  }

  async triggerUpdate(options?: UpdateOptions): Promise<void> {
    const client = this.getClient();
    const isImmediate = options?.mode === 'immediate';
    const updateType = isImmediate ? IAUUpdateKindEnum.IMMEDIATE : IAUUpdateKindEnum.FLEXIBLE;

    AnalyticsService.trackEvent('update_triggered', {
      mode: isImmediate ? 'immediate' : 'flexible',
      provider: this.name,
    });

    if (isImmediate) {
      // Play takes full control of the UI for immediate updates
      await client.startUpdate({ updateType });
      return;
    }

    // Flexible: observe download status, then install once DOWNLOADED
    await new Promise<void>((resolve, reject) => {
      const onStatusUpdate = (event: StatusUpdateEvent) => {
        if (event.status === IAUInstallStatusEnum.DOWNLOADED) {
          client.removeStatusUpdateListener(onStatusUpdate);
          AnalyticsService.trackEvent('update_downloaded', {
            status: String(event.status),
          });
          client.installUpdate();
          resolve();
        } else if (event.status === IAUInstallStatusEnum.FAILED) {
          client.removeStatusUpdateListener(onStatusUpdate);
          AnalyticsService.trackEvent('update_download_failed', { error_code: event.status });
          reject(new Error(`Flexible update ended with status: ${event.status}`));
        } else if (event.status === IAUInstallStatusEnum.CANCELED) {
          client.removeStatusUpdateListener(onStatusUpdate);
          AnalyticsService.trackEvent('update_download_canceled', { error_code: event.status });
          reject(new Error(`Flexible update ended with status: ${event.status}`));
        }
      };

      client.addStatusUpdateListener(onStatusUpdate);
      client.startUpdate({ updateType }).catch((err: unknown) => {
        client.removeStatusUpdateListener(onStatusUpdate);
        reject(err);
      });
    });
  }
}
