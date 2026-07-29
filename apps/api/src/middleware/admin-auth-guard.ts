import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Env, Variables } from '../index';
import { ERRORS, problem } from './problem-details';

export async function timingSafeCompare(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const hashA = await crypto.subtle.digest('SHA-256', encoder.encode(a));
  const hashB = await crypto.subtle.digest('SHA-256', encoder.encode(b));
  const aArr = new Uint8Array(hashA);
  const bArr = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < aArr.length; i++) {
    diff |= aArr[i] ^ bArr[i];
  }
  return diff === 0;
}

/**
 * Middleware that rejects the request with UNAUTHORIZED
 * when no valid admin_session cookie or Authorization Bearer key is provided.
 *
 *   router.post('/path', adminAuthGuard(), handler)
 */
export const adminAuthGuard = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> => {
  return async (c, next) => {
    const adminKey = c.env?.ADMIN_API_KEY;

    if (!adminKey) {
      return problem(c, ERRORS.MISCONFIG);
    }

    const sessionCookie = getCookie(c, 'admin_session');
    const authHeader = c.req.header('Authorization');

    let isAuthorized = false;

    if (sessionCookie) {
      isAuthorized = await timingSafeCompare(sessionCookie, adminKey);
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      isAuthorized = await timingSafeCompare(token, adminKey);
    }

    if (!isAuthorized) {
      return problem(c, ERRORS.UNAUTHORIZED);
    }

    await next();
  };
};
