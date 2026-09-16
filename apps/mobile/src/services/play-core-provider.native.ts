import { Platform, NativeModules } from 'react-native';
import type { UpdateOptions, UpdateProvider } from './update-service';

import SpInAppUpdates, { IAUUpdateKind, IAUInstallStatus } from 'sp-react-native-in-app-updates';
import type { StatusUpdateEvent } from 'sp-react-native-in-app-updates';
import { AnalyticsService } from './analytics';

/**
 * Native Google Play Core update provider for Android.
 * Coordinates flexible and immediate in-app updates directly within the app.
 */
export class PlayCoreUpdateProvider implements UpdateProvider {
  name = 'play-core';
  private inAppUpdates: SpInAppUpdates | null = null;

  private getClient(): SpInAppUpdates {
    if (!this.inAppUpdates) {
      this.inAppUpdates = new SpInAppUpdates(false);
    }
    return this.inAppUpdates;
  }

  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    return !!NativeModules.SpInAppUpdates;
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
    const updateType = isImmediate ? IAUUpdateKind.IMMEDIATE : IAUUpdateKind.FLEXIBLE;

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
        if (event.status === IAUInstallStatus.DOWNLOADED) {
          client.removeStatusUpdateListener(onStatusUpdate);
          AnalyticsService.trackEvent('update_installed', {
            status: String(event.status),
          });
          client.installUpdate();
          resolve();
        } else if (event.status === IAUInstallStatus.FAILED) {
          client.removeStatusUpdateListener(onStatusUpdate);
          AnalyticsService.trackEvent('update_download_failed', { error_code: event.status });
          reject(new Error(`Flexible update ended with status: ${event.status}`));
        } else if (event.status === IAUInstallStatus.CANCELED) {
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
