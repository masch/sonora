import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';

export const configGuard = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    c.set('configEnv', {
      minimumVersion: c.env?.MINIMUM_APP_VERSION || '1.0.0',
      blockOlderVersions: c.env?.BLOCK_OLDER_VERSIONS === 'true',
      gracePeriodStart: c.env?.GRACE_PERIOD_START,
      gracePeriodEnd: c.env?.GRACE_PERIOD_END,
    });
    await next();
  };
};
