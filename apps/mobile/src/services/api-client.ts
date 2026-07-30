import { Platform } from 'react-native';
import { APP_CONFIG } from '@/config/app-config';
import { appStorage, getDeviceId } from '@/storage/app-storage';
import { logger } from '@/utils/logger';
import { BaseApiClient, type RequestOptions } from '@sonora/shared';

class MobileApiClient extends BaseApiClient {
  protected override async getAuthHeader(): Promise<Record<string, string>> {
    const deviceId = await getDeviceId();
    if (!deviceId) {
      const err = new Error('Mandatory X-Device-Id is missing in client storage');
      logger.error('Failed to retrieve device ID for API headers', err);
      throw err;
    }
    return {
      'X-Device-Id': deviceId,
      'X-Device-Platform': Platform.OS as string,
    };
  }
}

const client = new MobileApiClient({
  baseUrl: APP_CONFIG.apiBaseUrl,
  storage: appStorage,
  logInfo: (msg) => logger.info(msg),
  logWarning: (msg) => logger.warn(msg),
  logError: (msg) => logger.error(msg),
});

export { RequestOptions };

export const ApiClient = {
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return client.request<T>(path, options);
  },

  async get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return client.get<T>(path, options);
  },

  async post<T>(
    path: string,
    body: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return client.post<T>(path, body, options);
  },

  async put<T>(
    path: string,
    body: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return client.request<T>(path, { ...options, method: 'PUT', body });
  },

  async patch<T>(
    path: string,
    body: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return client.request<T>(path, { ...options, method: 'PATCH', body });
  },

  async delete<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return client.request<T>(path, { ...options, method: 'DELETE' });
  },

  /**
   * Performs a raw fetch request enforcing that the mandatory X-Device-Id and X-Device-Platform headers are attached.
   */
  async fetchWithDeviceId(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const deviceId = await getDeviceId();
    if (!deviceId) {
      throw new Error('Mandatory X-Device-Id is missing in client storage');
    }
    const headers = new Headers(init.headers || {});
    headers.set('X-Device-Id', deviceId);
    headers.set('X-Device-Platform', Platform.OS as string);

    return fetch(input, {
      ...init,
      headers,
    });
  },
};
