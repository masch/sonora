import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';
import { ERRORS, problem } from './problem-details';

export const requireAdminKey = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    const adminKey = c.env?.ADMIN_API_KEY;

    if (!adminKey) {
      return problem(c, ERRORS.MISCONFIG);
    }

    const authHeader = c.req.header('Authorization');
    if (authHeader !== `Bearer ${adminKey}`) {
      return problem(c, ERRORS.UNAUTHORIZED);
    }

    await next();
  };
};
