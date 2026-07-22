import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';
import { ERRORS, problem } from './problem-details';

/**
 * Middleware that rejects the request with STORAGE_NOT_CONFIG
 * when no PRIVATE_BUCKET R2 binding is configured on the context.
 *
 * Use on any route that requires access to private R2 storage:
 *
 *   router.post('/upload', privateBucketGuard(), handler)
 */
export const privateBucketGuard = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    if (!c.env?.PRIVATE_BUCKET) {
      return problem(c, ERRORS.STORAGE_NOT_CONFIG);
    }
    c.set('privateBucket', c.env.PRIVATE_BUCKET);
    await next();
  };
};
