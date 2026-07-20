import { DEVICE_ID_KEY, generateUuid } from '@sonora/shared';
import { logger } from '@/utils/logger';

export const DeviceService = {
  async getPlatformDeviceId(): Promise<string> {
    try {
      let deviceId = localStorage.getItem(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = generateUuid();
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
      }
      return deviceId;
    } catch (err) {
      logger.error('Failed to get web platform device ID', err);
      return 'fallback-web-device-id';
    }
  },
};
