import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';
import { ERRORS, problem } from './problem-details';

/**
 * Middleware that rejects the request with DEVICE_ID_REQUIRED
 * when no X-Device-Id header was provided (c.var.deviceId is empty).
 *
 * Must run AFTER injectDeviceId() middleware, which reads the header
 * and sets c.var.deviceId.
 *
 *   router.get('/path', injectDeviceId(), deviceIdGuard(), handler)
 */
export const deviceIdGuard = (): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> => {
  return async (c, next) => {
    if (!c.var.deviceId) {
      return problem(c, ERRORS.DEVICE_ID_REQUIRED);
    }
    await next();
  };
};
