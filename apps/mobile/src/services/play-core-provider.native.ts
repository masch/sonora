import { Platform, NativeModules } from 'react-native';
import type { UpdateOptions, UpdateProvider } from './update-service';

import SpInAppUpdates, { IAUUpdateKind } from 'sp-react-native-in-app-updates';

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

  async triggerUpdate(options?: UpdateOptions): Promise<void> {
    const client = this.getClient();
    const updateType =
      options?.mode === 'immediate' ? IAUUpdateKind.IMMEDIATE : IAUUpdateKind.FLEXIBLE;

    await client.startUpdate({ updateType });
  }
}
