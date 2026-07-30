import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../index';
import { PLATFORMS } from '@sonora/shared';
import type { Platform } from '@sonora/shared';

export async function hashDeviceId(deviceId: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(deviceId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// VALID_PLATFORMS and Platform type imported from @sonora/shared
// PLATFORM_DEFAULT available for fallback: 'unknown'

export const injectDeviceId = (): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> => {
  return async (c, next) => {
    const rawDeviceId = c.req.header('X-Device-Id');
    if (rawDeviceId !== undefined) {
      // Validate: reject empty, whitespace-only, or overly long values
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

      // PASSTHROUGH — client sends pre-hashed value, do NOT hash again
      c.set('deviceId', rawDeviceId);
    }

    // X-Device-Platform handling
    const platformHeader = c.req.header('X-Device-Platform');
    if (platformHeader !== undefined) {
      if (PLATFORMS.includes(platformHeader as Platform)) {
        c.set('devicePlatform', platformHeader as Platform);
      }
      // Invalid platform values are silently ignored
    }

    await next();
  };
};
