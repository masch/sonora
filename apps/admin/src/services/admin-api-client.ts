import { APP_CONFIG } from '@/config/app-config';
import type { TranslationBulkPayload } from '@sonora/shared';

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
    const url = path.startsWith('http') ? path : `${APP_CONFIG.apiBaseUrl}${path}`;
    const key = this.getAuthKey();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorMsg = await response.text().catch(() => 'Request failed');
      throw new Error(errorMsg || `Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
  },

  async getTranslations(lang: string): Promise<Record<string, string>> {
    return this.request<Record<string, string>>(`/api/translations/${lang}`);
  },

  async setTranslations(payload: TranslationBulkPayload): Promise<{ updated: number }> {
    return this.request<{ updated: number }>('/api/translations', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};
