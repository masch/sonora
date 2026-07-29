import { APP_CONFIG } from '@/config/app-config';
import { BaseApiClient, type RequestOptions, type TranslationBulkPayload } from '@sonora/shared';

const client = new BaseApiClient({
  baseUrl: APP_CONFIG.apiBaseUrl,
  credentials: 'include',
});

export const AdminApiClient = {
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return client.request<T>(path, options);
  },

  async getTranslations(lang: string): Promise<Record<string, string>> {
    return client.get<Record<string, string>>(`/api/translations/${lang}`);
  },

  async setTranslations(payload: TranslationBulkPayload): Promise<{ updated: number }> {
    return client.put<{ updated: number }>('/api/translations', payload);
  },

  async loginSession(key: string): Promise<boolean> {
    try {
      await client.post('/api/translations/session', { key });
      return true;
    } catch {
      return false;
    }
  },

  async logoutSession(): Promise<boolean> {
    try {
      await client.delete('/api/translations/session');
      return true;
    } catch {
      return false;
    }
  },

  async checkSession(): Promise<boolean> {
    try {
      const res = await client.get<{ valid: boolean }>('/api/translations/session');
      return res?.valid === true;
    } catch {
      return false;
    }
  },

  async validateKey(key: string): Promise<boolean> {
    return this.loginSession(key);
  },

  async clearAuthKey(): Promise<boolean> {
    return this.logoutSession();
  },
};
