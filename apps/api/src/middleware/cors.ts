import { cors } from 'hono/cors';
import { type MiddlewareHandler } from 'hono';
import { type Env } from '../index';

export const configureCors = (): MiddlewareHandler => {
  return async (c, next) => {
    const getEnvVar = (key: string): string | undefined => {
      return (
        c.env?.[key as keyof Env] || (typeof process !== 'undefined' ? process.env[key] : undefined)
      );
    };

    const allowedOrigin = getEnvVar('ALLOWED_ORIGIN');
    const allowedMethods = getEnvVar('ALLOWED_METHODS');
    const allowedHeaders = getEnvVar('ALLOWED_HEADERS');

    const methods = allowedMethods
      ? allowedMethods.split(',').map((m) => m.trim())
      : ['POST', 'GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
    const headers = allowedHeaders
      ? allowedHeaders.split(',').map((h) => h.trim())
      : ['Content-Type', 'Authorization', 'Range', 'Cache-Control', 'Pragma'];

    const corsMiddleware = cors({
      origin: (origin) => {
        // Allow missing/empty origin (native HTTP clients — no ACAO needed)
        if (!origin) {
          return null;
        }
        // Allow Origin: null (mobile WebView, SFSafariViewController)
        if (origin === 'null') {
          return 'null';
        }
        // If ALLOWED_ORIGIN is not configured, allow all origins (permissive)
        if (!allowedOrigin) {
          return origin;
        }
        // Check against comma-separated list of allowed origins
        const origins = allowedOrigin.split(',').map((o) => o.trim());
        return origins.includes(origin) ? origin : null;
      },
      allowMethods: methods,
      allowHeaders: headers,
      exposeHeaders: ['Content-Length', 'Content-Range', 'ETag', 'x-audio-etag'],
    });

    return corsMiddleware(c, next);
  };
};
