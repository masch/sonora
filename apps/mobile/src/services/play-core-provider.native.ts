import { Platform, NativeModules } from 'react-native';
import type { UpdateOptions, UpdateProvider } from './update-service';

// Dynamic load: sp-react-native-in-app-updates references native modules at require time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SpInAppUpdatesModule: any = null;
let IAUUpdateKindEnum = {
  FLEXIBLE: 0,
  IMMEDIATE: 1,
};

function getSpInAppUpdatesClass() {
  if (!SpInAppUpdatesModule) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('sp-react-native-in-app-updates');
      SpInAppUpdatesModule = mod.default || mod;
      if (mod.IAUUpdateKind) {
        IAUUpdateKindEnum = mod.IAUUpdateKind;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private inAppUpdates: any = null;

  private getClient() {
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
    const InAppClass = getSpInAppUpdatesClass();
    return !!InAppClass;
  }

  async triggerUpdate(options?: UpdateOptions): Promise<void> {
    const client = this.getClient();
    const updateType =
      options?.mode === 'immediate' ? IAUUpdateKindEnum.IMMEDIATE : IAUUpdateKindEnum.FLEXIBLE;

    await client.startUpdate({ updateType });
  }
}
