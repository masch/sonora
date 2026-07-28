import { APP_CONFIG } from '@/config/app-config';
import { BaseApiClient, type TranslationBulkPayload } from '@sonora/shared';

let inMemoryAuthKey: string | null = null;

const client = new BaseApiClient({
  baseUrl: APP_CONFIG.apiBaseUrl,
  getAuthToken: () => inMemoryAuthKey,
});

export const AdminApiClient = {
  getAuthKey(): string | null {
    return inMemoryAuthKey;
  },

  setAuthKey(key: string): void {
    inMemoryAuthKey = key;
  },

  clearAuthKey(): void {
    inMemoryAuthKey = null;
  },

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    return client.request<T>(path, options);
  },

  async getTranslations(lang: string): Promise<Record<string, string>> {
    return client.get<Record<string, string>>(`/api/translations/${lang}`);
  },

  async setTranslations(payload: TranslationBulkPayload): Promise<{ updated: number }> {
    return client.put<{ updated: number }>('/api/translations', payload);
  },

  async validateKey(key: string): Promise<boolean> {
    try {
      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/translations/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
      });
      return response.status === 200;
    } catch {
      return false;
    }
  },
};
