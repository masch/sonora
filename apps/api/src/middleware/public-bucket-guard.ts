import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';
import { ERRORS, problem } from './problem-details';

/**
 * Middleware that rejects the request with STORAGE_NOT_CONFIG
 * when no PUBLIC_BUCKET R2 binding is configured on the context.
 *
 * Use on any route that requires access to public R2 storage:
 *
 *   router.get('/public/:key', publicBucketGuard(), handler)
 */
export const publicBucketGuard = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    if (!c.env?.PUBLIC_BUCKET) {
      return problem(c, ERRORS.STORAGE_NOT_CONFIG);
    }
    c.set('publicBucket', c.env.PUBLIC_BUCKET);
    await next();
  };
};
