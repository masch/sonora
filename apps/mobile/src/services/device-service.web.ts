import { DEVICE_ID_KEY, generateUuid, sha256 } from '@sonora/shared';
import { logger } from '@/utils/logger';

export const DeviceService = {
  async getPlatformDeviceId(): Promise<string> {
    try {
      let rawDeviceId = localStorage.getItem(DEVICE_ID_KEY);
      if (!rawDeviceId) {
        rawDeviceId = generateUuid();
        localStorage.setItem(DEVICE_ID_KEY, rawDeviceId);
      }

      const hash = await sha256(rawDeviceId);
      return hash;
    } catch (err) {
      logger.error('Failed to get web platform device ID', err);
      return 'fallback-web-device-id';
    }
  },
};
