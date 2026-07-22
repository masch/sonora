import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';
import { ERRORS, problem } from './problem-details';

/**
 * Middleware that rejects the request with DB_NOT_AVAILABLE
 * when no database client is configured on the context.
 *
 * Use on any route that requires a database connection:
 *
 *   router.get('/path', dbGuard, handler)
 *   router.use('/*', dbGuard)  // entire router
 */
export const dbGuard = (): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> => {
  return async (c, next) => {
    if (!c.var.db) {
      return problem(c, ERRORS.DB_NOT_AVAILABLE);
    }
    await next();
  };
};
