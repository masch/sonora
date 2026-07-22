import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';

export const envGuard = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    c.set('environment', c.env?.ENVIRONMENT || 'unknown');
    c.set('feedbackStore', c.env?.FEEDBACK_STORE);
    await next();
  };
};
