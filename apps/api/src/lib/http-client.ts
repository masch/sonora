import { logger } from '@sonora/shared';
import { sanitizeHeaders, sanitizeUrl } from './log-redaction';

export class HttpError extends Error {
  constructor(
    public status: number,
    public body?: string,
  ) {
    super(`HTTP ${status}: ${(body || '').slice(0, 200)}`);
    this.name = 'HttpError';
  }
}

interface HttpClientConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

export class HttpClient {
  private defaultTimeout: number;

  constructor(private config: HttpClientConfig) {
    this.defaultTimeout = config.timeout ?? 10_000;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const timeout = options.timeout ?? this.defaultTimeout;
    const method = options.method ?? 'GET';
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const headers = {
      'Content-Type': 'application/json',
      ...this.config.headers,
      ...options.headers,
    };
    const bodyString = options.body ? JSON.stringify(options.body) : undefined;

    logger.info(`[HTTP Request] ${method} ${sanitizeUrl(url)}`, {
      headers: sanitizeHeaders(headers),
    });

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: bodyString,
        signal: controller.signal,
      });

      const duration = Date.now() - startTime;

      let responseText = '';
      try {
        if (typeof res.clone === 'function') {
          const clonedRes = res.clone();
          responseText = await clonedRes.text();
        } else if (typeof res.text === 'function') {
          responseText = await res.text();
        }
      } catch (e) {
        logger.warn('Failed to read response body text for logging:', {
          error: e instanceof Error ? e.name : 'unknown',
        });
      }

      logger.info(`[HTTP Response] ${method} ${sanitizeUrl(url)} - ${res.status} (${duration}ms)`, {
        status: res.status,
      });

      if (!res.ok) {
        throw new HttpError(res.status, responseText || res.statusText);
      }

      // Handle 204 No Content
      if (res.status === 204) {
        return undefined as T;
      }

      return (await res.json()) as T;
    } catch (err) {
      const duration = Date.now() - startTime;
      logger.error(
        `[HTTP Request Error] ${method} ${sanitizeUrl(url)} - Failed after ${duration}ms:`,
        {
          error: err instanceof Error ? err.name : 'unknown',
          status: err instanceof HttpError ? err.status : undefined,
        },
      );
      if (err instanceof HttpError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new HttpError(408, `Request timeout after ${timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }
}
