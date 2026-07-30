import SqliteStorage from 'expo-sqlite/kv-store';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { DEVICE_ID_KEY, generateUuid } from '@sonora/shared';

export const DeviceService = {
  async getPlatformDeviceId(): Promise<string> {
    try {
      let rawDeviceId: string | null = null;
      if (Platform.OS === 'android') {
        rawDeviceId = Application.getAndroidId();
      } else if (Platform.OS === 'ios') {
        rawDeviceId = await Application.getIosIdForVendorAsync();
      }

      if (!rawDeviceId) {
        // Fallback to persisted UUID on native SQLite storage
        rawDeviceId = await SqliteStorage.getItem(DEVICE_ID_KEY);
        if (!rawDeviceId) {
          rawDeviceId = generateUuid();
          await SqliteStorage.setItem(DEVICE_ID_KEY, rawDeviceId);
        }
      }

      // SHA-256 hash the raw device ID before returning
      // The raw ID is never stored or exposed outside this function
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawDeviceId);
      return hash;
    } catch {
      return 'fallback-device-id';
    }
  },
};
