import { logger } from '../utils/logger';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken?: () => string | null | Promise<string | null>;
  storage?: KeyValueStorage;
  credentials?: 'omit' | 'same-origin' | 'include';
  logInfo?: (message: string) => void;
  logWarning?: (message: string) => void;
  logError?: (message: string) => void;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  cacheKey?: string;
  skipCache?: boolean;
  body?: unknown;
  /**
   * Optional transform function to map raw API responses before returning or caching.
   *
   * TECHNICAL NOTE: Why `never` instead of `any` or `unknown`?
   * TypeScript enforces contravariance on function arguments.
   * If we type this as `(data: unknown) => unknown`, callers would be forced to
   * declare their callback arguments as `unknown` (e.g. `(data: unknown) => ...`)
   * and cast them internally.
   *
   * If we type this as `(data: never) => unknown`, we exploit the fact that `never`
   * is a subtype of every type (the "bottom type"). Because of function argument
   * contravariance, a function expecting a specific subtype (e.g., `(data: Experience[]) => ...`)
   * can be safely assigned to a signature expecting `never`. This allows callers to
   * provide strongly typed mapping functions out of the box without using `any`.
   *
   * Example:
   * ```ts
   * ApiClient.get<Experience[]>('/experiences', {
   *   transform: (data: Experience[]) => data.filter(...) // Safe, compiles!
   * });
   * ```
   */
  transform?: (data: never) => unknown;
  customErrorMessage?: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class BaseApiClient {
  constructor(protected config: ApiClientConfig) {}

  protected async getAuthHeader(): Promise<Record<string, string>> {
    if (this.config.getAuthToken) {
      const token = await this.config.getAuthToken();
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    }
    return {};
  }

  protected async getErrorBody(response: Response): Promise<unknown> {
    try {
      if (typeof response.clone === 'function') {
        return await response.clone().json();
      }
      return await response.json();
    } catch (err) {
      logger.debug('Failed to parse error response as JSON, falling back to text', err);
    }

    try {
      return await response.text();
    } catch (err) {
      logger.error('Failed to parse error response as text', err);
    }

    return undefined;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { cacheKey, skipCache, body, transform, customErrorMessage, ...fetchOptions } = options;
    const url = path.startsWith('http') ? path : `${this.config.baseUrl}${path}`;
    const method = fetchOptions.method || 'GET';

    const authHeader = await this.getAuthHeader();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...authHeader,
      ...((fetchOptions.headers as Record<string, string>) || {}),
    };

    const fetchConfig = {
      credentials: this.config.credentials,
      ...fetchOptions,
      headers,
    } as RequestInit;

    if (body !== undefined) {
      fetchConfig.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    if (method === 'GET' && !skipCache && cacheKey && this.config.storage) {
      const storage = this.config.storage;
      try {
        const response = await fetch(url, fetchConfig);
        const ok =
          response.ok !== undefined ? response.ok : response.status >= 200 && response.status < 300;

        if (!ok) {
          const errorBody = await this.getErrorBody(response);
          throw new ApiError(
            response.status,
            response.statusText || '',
            customErrorMessage || `Request failed with status ${response.status}`,
            errorBody,
          );
        }

        const rawData = typeof response.json === 'function' ? await response.json() : {};
        const data = transform ? (transform as (d: unknown) => unknown)(rawData) : rawData;

        // Async write to cache
        storage.setItem(cacheKey, JSON.stringify(data)).catch((err) => {
          const errMsg = `Failed to write cache for ${cacheKey}: ${err instanceof Error ? err.message : String(err)}`;
          if (this.config.logWarning) {
            this.config.logWarning(errMsg);
          } else {
            logger.warn(errMsg);
          }
        });

        return data as T;
      } catch (error) {
        const infoMsg = `[Offline Mode] Fetch failed for ${url}, loading from cache (${cacheKey})...`;
        if (this.config.logInfo) {
          this.config.logInfo(infoMsg);
        } else {
          logger.info(infoMsg);
        }

        // Try reading from cache
        try {
          const cached = await storage.getItem(cacheKey);
          if (cached !== null) {
            return JSON.parse(cached) as T;
          }
        } catch (cacheError) {
          const errMsg = `Failed to read cache for ${cacheKey}: ${cacheError instanceof Error ? cacheError.message : String(cacheError)}`;
          if (this.config.logError) {
            this.config.logError(errMsg);
          } else {
            logger.error(errMsg);
          }
        }

        throw error;
      }
    }

    const response = await fetch(url, fetchConfig);
    const ok =
      response.ok !== undefined ? response.ok : response.status >= 200 && response.status < 300;

    if (!ok) {
      const errorBody = await this.getErrorBody(response);
      throw new ApiError(
        response.status,
        response.statusText || '',
        customErrorMessage || `Request failed with status ${response.status}`,
        errorBody,
      );
    }

    const rawData = typeof response.json === 'function' ? await response.json() : {};
    return (transform ? (transform as (d: unknown) => unknown)(rawData) : rawData) as T;
  }

  async get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async post<T>(
    path: string,
    body: unknown = {},
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body,
    });
  }

  async put<T>(
    path: string,
    body: unknown = {},
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body,
    });
  }

  async delete<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}
