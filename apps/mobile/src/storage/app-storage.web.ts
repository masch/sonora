import { type KeyValueStorage } from '@sonora/shared';
import { DeviceService } from '@/services/device-service';
import { createStorageFunctions } from './app-storage-common';

export const appStorage: KeyValueStorage & {
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
} = {
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    return localStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    return localStorage.removeItem(key);
  },

  async clear(): Promise<void> {
    return localStorage.clear();
  },
};

const { getPurchasedIds, addPurchasedId, getUserEmail, setUserEmail, getDeviceId } =
  createStorageFunctions(appStorage, DeviceService.getPlatformDeviceId);

export { getPurchasedIds, addPurchasedId, getUserEmail, setUserEmail, getDeviceId };
