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
    if (rawDeviceId !== undefined) {
      // Validate: reject empty, whitespace-only, or overly long values
      // The SHA-256 hash neutralizes any malicious content, and Android uses
      // a 64-bit hex ID (not UUID v4), so we accept any reasonable identifier.
      if (rawDeviceId.length === 0) {
        return c.json(
          {
            code: 'INVALID_DEVICE_ID',
            detail: 'The X-Device-Id header must not be empty.',
            status: 400,
          },
          400,
        );
      }
      if (rawDeviceId.trim().length === 0) {
        return c.json(
          {
            code: 'INVALID_DEVICE_ID',
            detail: 'The X-Device-Id header must not be empty.',
            status: 400,
          },
          400,
        );
      }
      if (rawDeviceId.length > 256) {
        return c.json(
          {
            code: 'INVALID_DEVICE_ID',
            detail: 'The X-Device-Id header must be 256 characters or fewer.',
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
