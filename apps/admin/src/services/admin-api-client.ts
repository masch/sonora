import { APP_CONFIG } from '@/config/app-config';
import { BaseApiClient, type TranslationBulkPayload } from '@sonora/shared';

const client = new BaseApiClient({
  baseUrl: APP_CONFIG.apiBaseUrl,
  getAuthToken: () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin_key');
    }
    return null;
  },
});

export const AdminApiClient = {
  getAuthKey(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin_key');
    }
    return null;
  },

  setAuthKey(key: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_key', key);
    }
  },

  clearAuthKey(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_key');
    }
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
