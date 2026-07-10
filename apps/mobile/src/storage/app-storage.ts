import SqliteStorage from 'expo-sqlite/kv-store';
import { type KeyValueStorage } from '@sonora/shared';

export const appStorage: KeyValueStorage & {
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
} = {
  async getItem(key: string): Promise<string | null> {
    return SqliteStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    return SqliteStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    return SqliteStorage.removeItem(key);
  },

  async clear(): Promise<void> {
    return SqliteStorage.clear();
  },
};
