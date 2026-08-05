import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';
import { ERRORS, problem } from './problem-details';

/**
 * Rejects the request with INVALID_REQUEST_URL (400) when `c.req.url` is not a
 * valid absolute http(s) URL.
 *
 * Run this guard on any route that builds absolute URLs from the request
 * origin. Once it passes, `new URL(c.req.url).origin` cannot throw, so
 * handlers can use it directly without try/catch.
 *
 *   app.use('/experiences/*', urlGuard())   // per group
 *   router.get('/', urlGuard(), handler)    // per route
 */
export const urlGuard = (): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> => {
  return async (c, next) => {
    let url: URL;
    try {
      url = new URL(c.req.url);
    } catch {
      return problem(c, ERRORS.INVALID_REQUEST_URL);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return problem(c, ERRORS.INVALID_REQUEST_URL);
    }
    c.set('requestUrl', url);
    return next();
  };
};
