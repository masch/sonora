import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';
import { ERRORS, problem } from './problem-details';

/**
 * Middleware that rejects the request with PLATFORM_REQUIRED
 * when no X-Device-Platform header was provided (c.var.devicePlatform is empty).
 *
 * Must run AFTER injectDeviceId() middleware, which reads the header
 * and sets c.var.devicePlatform.
 *
 *   router.post('/path', injectDeviceId(), platformGuard(), handler)
 */
export const platformGuard = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    if (!c.var.devicePlatform) {
      return problem(c, ERRORS.PLATFORM_REQUIRED);
    }
    await next();
  };
};
