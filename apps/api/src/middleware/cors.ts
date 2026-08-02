import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../index';

const DEFAULT_METHODS = ['POST', 'GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
const DEFAULT_HEADERS = [
  'Content-Type',
  'Authorization',
  'Range',
  'Cache-Control',
  'Pragma',
  'X-Device-Id',
  'X-Device-Platform',
  'X-App-Version',
  'X-Signature',
  'X-Timestamp',
  'X-Nonce',
  'Retry-After',
];
const EXPOSED_HEADERS = ['Content-Length', 'Content-Range', 'ETag', 'x-audio-etag', 'Retry-After'];
const MAX_AGE = 86400;

/**
 * Environment-aware CORS middleware.
 *
 * Reads from env bindings per-request:
 *   ALLOWED_ORIGIN  — comma-separated list of allowed origins (secret)
 *   ALLOWED_METHODS — comma-separated HTTP methods (optional, uses defaults)
 *   ALLOWED_HEADERS — comma-separated request headers (optional, uses defaults)
 *
 * Falls back to permissive (echo origin) when ALLOWED_ORIGIN is not set.
 */
export const configureCors = (): MiddlewareHandler => {
  return async (c, next) => {
    const env = c.env as Env | undefined;

    const methods = env?.ALLOWED_METHODS
      ? env.ALLOWED_METHODS.split(',').map((m) => m.trim())
      : DEFAULT_METHODS;

    const headers = env?.ALLOWED_HEADERS
      ? env.ALLOWED_HEADERS.split(',').map((h) => h.trim())
      : DEFAULT_HEADERS;

    const corsMiddleware = cors({
      origin: (origin) => {
        if (!origin || origin === 'null') return origin;

        const allowed = env?.ALLOWED_ORIGIN;
        if (!allowed) return origin;

        return allowed
          .split(',')
          .map((o) => o.trim())
          .includes(origin)
          ? origin
          : null;
      },
      allowMethods: methods,
      allowHeaders: headers,
      exposeHeaders: EXPOSED_HEADERS,
      credentials: true,
      maxAge: MAX_AGE,
    });

    return corsMiddleware(c, next);
  };
};
