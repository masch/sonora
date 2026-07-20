import { type KeyValueStorage } from '@sonora/shared';
import { logger } from '@/utils/logger';

const PURCHASED_EXPERIENCES_KEY = 'purchased_experiences';
const USER_EMAIL_KEY = 'user_email';

export function createStorageFunctions(
  storage: KeyValueStorage & {
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
  },
  getPlatformDeviceId: () => Promise<string>,
) {
  const getPurchasedIds = async (): Promise<Set<string>> => {
    try {
      const raw = await storage.getItem(PURCHASED_EXPERIENCES_KEY);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      logger.warn('[AppStorage] Failed to read purchased IDs');
      return new Set<string>();
    }
  };

  const addPurchasedId = async (id: string): Promise<void> => {
    try {
      const ids = await getPurchasedIds();
      ids.add(id);
      await storage.setItem(PURCHASED_EXPERIENCES_KEY, JSON.stringify([...ids]));
    } catch {
      logger.warn('[AppStorage] Failed to save purchased ID');
    }
  };

  const getUserEmail = async (): Promise<string | null> => {
    try {
      return await storage.getItem(USER_EMAIL_KEY);
    } catch {
      logger.warn('[AppStorage] Failed to read user email');
      return null;
    }
  };

  const setUserEmail = async (email: string): Promise<void> => {
    try {
      await storage.setItem(USER_EMAIL_KEY, email);
    } catch {
      logger.warn('[AppStorage] Failed to save user email');
    }
  };

  const getDeviceId = async (): Promise<string> => {
    try {
      return await getPlatformDeviceId();
    } catch {
      logger.warn('[AppStorage] Failed to read or generate device ID');
      return 'fallback-device-id';
    }
  };

  return { getPurchasedIds, addPurchasedId, getUserEmail, setUserEmail, getDeviceId };
}

export type AppStorageFunctions = ReturnType<typeof createStorageFunctions>;
