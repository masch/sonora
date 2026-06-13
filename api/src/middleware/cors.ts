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
      : ['POST', 'GET', 'OPTIONS'];
    const headers = allowedHeaders
      ? allowedHeaders.split(',').map((h) => h.trim())
      : ['Content-Type', 'Authorization'];

    const corsMiddleware = cors({
      origin: (origin) => (origin === allowedOrigin ? origin : undefined),
      allowMethods: methods,
      allowHeaders: headers,
    });

    return corsMiddleware(c, next);
  };
};
