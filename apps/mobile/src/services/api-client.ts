import { APP_CONFIG } from '@/config/app-config';
import { appStorage, getDeviceId } from '@/storage/app-storage';
import { logger } from '@/utils/logger';
import { BaseApiClient, type RequestOptions } from '@sonora/shared';

class MobileApiClient extends BaseApiClient {
  protected override async getAuthHeader(): Promise<Record<string, string>> {
    try {
      const deviceId = await getDeviceId();
      return deviceId ? { 'X-Device-Id': deviceId } : {};
    } catch (err) {
      logger.error('Failed to retrieve device ID for API headers', err);
      return {};
    }
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
};
