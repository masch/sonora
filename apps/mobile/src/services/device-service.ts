import SqliteStorage from 'expo-sqlite/kv-store';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { DEVICE_ID_KEY, generateUuid } from '@sonora/shared';

export const DeviceService = {
  async getPlatformDeviceId(): Promise<string> {
    try {
      let deviceId: string | null = null;
      if (Platform.OS === 'android') {
        deviceId = Application.getAndroidId();
      } else if (Platform.OS === 'ios') {
        deviceId = await Application.getIosIdForVendorAsync();
      }

      if (!deviceId) {
        // Fallback to persisted UUID on native SQLite storage
        deviceId = await SqliteStorage.getItem(DEVICE_ID_KEY);
        if (!deviceId) {
          deviceId = generateUuid();
          await SqliteStorage.setItem(DEVICE_ID_KEY, deviceId);
        }
      }
      return deviceId;
    } catch {
      return 'fallback-device-id';
    }
  },
};
