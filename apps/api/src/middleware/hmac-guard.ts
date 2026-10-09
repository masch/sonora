import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';
import { ERRORS, problem } from './problem-details';

export const hmacGuard = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    const hmacSecret = c.env?.HMAC_SECRET;
    if (!hmacSecret) {
      return problem(c, ERRORS.HMAC_SECRET_MISSING);
    }
    c.set('hmacSecret', hmacSecret);
    await next();
  };
};
