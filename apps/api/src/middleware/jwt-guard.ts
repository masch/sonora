import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';
import { ERRORS, problem } from './problem-details';

export const jwtGuard = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    const jwtSecret = c.env?.JWT_SECRET;
    if (!jwtSecret) {
      return problem(c, ERRORS.JWT_SECRET_MISSING);
    }
    c.set('jwtSecret', jwtSecret);
    const expiry = parseInt(c.env?.AUDIO_LINK_EXPIRY_SECONDS || '900', 10);
    c.set('audioLinkExpirySeconds', expiry);
    await next();
  };
};
