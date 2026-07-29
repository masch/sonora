import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function hashDeviceId(deviceId: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(deviceId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const injectDeviceId = (): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> => {
  return async (c, next) => {
    const rawDeviceId = c.req.header('X-Device-Id');
    if (rawDeviceId !== undefined) {
      // Validate format before hashing
      if (rawDeviceId.length === 0) {
        return c.json(
          {
            code: 'INVALID_DEVICE_ID',
            detail: 'The X-Device-Id header must be a valid UUID v4.',
            status: 400,
          },
          400,
        );
      }
      if (rawDeviceId.trim().length === 0) {
        return c.json(
          {
            code: 'INVALID_DEVICE_ID',
            detail: 'The X-Device-Id header must be a valid UUID v4.',
            status: 400,
          },
          400,
        );
      }
      if (rawDeviceId.length > 256) {
        return c.json(
          {
            code: 'INVALID_DEVICE_ID',
            detail: 'The X-Device-Id header must be a valid UUID v4.',
            status: 400,
          },
          400,
        );
      }
      if (!UUID_V4_REGEX.test(rawDeviceId)) {
        return c.json(
          {
            code: 'INVALID_DEVICE_ID',
            detail: 'The X-Device-Id header must be a valid UUID v4.',
            status: 400,
          },
          400,
        );
      }

      const hashed = await hashDeviceId(rawDeviceId);
      c.set('deviceId', hashed);
    }
    await next();
  };
};
