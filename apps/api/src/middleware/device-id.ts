import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';

export async function hashDeviceId(deviceId: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(deviceId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const injectDeviceId = (): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> => {
  return async (c, next) => {
    const rawDeviceId = c.req.header('X-Device-Id');
    if (rawDeviceId) {
      const hashed = await hashDeviceId(rawDeviceId);
      c.set('deviceId', hashed);
    }
    await next();
  };
};
