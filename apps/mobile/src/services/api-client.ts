import { APP_CONFIG } from '@/config/app-config';
import { getItem, setItem } from '@/storage/feedback-storage';
import { logger } from '@/utils/logger';

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  cacheKey?: string;
  skipCache?: boolean;
  body?: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform?: (data: any) => any;
  customErrorMessage?: string;
}

export const ApiClient = {
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { cacheKey, skipCache, body, transform, customErrorMessage, ...fetchOptions } = options;
    const url = path.startsWith('http') ? path : `${APP_CONFIG.apiBaseUrl}${path}`;
    const method = fetchOptions.method;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((fetchOptions.headers as Record<string, string>) || {}),
    };

    const fetchConfig: RequestInit = {
      ...fetchOptions,
      headers,
    };

    if (body !== undefined) {
      fetchConfig.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    if (method === 'GET' && !skipCache && cacheKey) {
      try {
        const response = await fetch(url, fetchConfig);
        const ok =
          response.ok !== undefined ? response.ok : response.status >= 200 && response.status < 300;
        if (!ok) {
          throw new Error(customErrorMessage || `Request failed with status ${response.status}`);
        }
        const rawData = await response.json();
        const data = transform ? transform(rawData) : rawData;
        // Asynchronously save to cache
        setItem(cacheKey, JSON.stringify(data)).catch((err) => {
          logger.warn(
            `Failed to write cache for ${cacheKey}: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
        return data as T;
      } catch (error) {
        logger.info(`[Offline Mode] Fetch failed for ${url}, loading from cache (${cacheKey})...`);
        try {
          const cached = await getItem(cacheKey);
          if (cached) {
            return JSON.parse(cached) as T;
          }
        } catch (cacheError) {
          logger.error(
            `Failed to read cache for ${cacheKey}: ${cacheError instanceof Error ? cacheError.message : String(cacheError)}`,
          );
        }
        throw error;
      }
    }

    const response = await fetch(url, fetchConfig);
    const ok =
      response.ok !== undefined ? response.ok : response.status >= 200 && response.status < 300;
    if (!ok) {
      throw new Error(customErrorMessage || `Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
  },

  async get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  },

  async post<T>(
    path: string,
    body: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body,
    });
  },
};
