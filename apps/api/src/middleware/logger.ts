import { logger } from '@sonora/shared';
import type { MiddlewareHandler } from 'hono';
import {
  extractSafeBodyFields,
  sanitizeHeaders,
  sanitizeQuery,
  sanitizeUrl,
  UNPARSEABLE_BODY,
} from '../lib/log-redaction';

export const customLogger = (): MiddlewareHandler => {
  return async (c, next) => {
    const enableLogging = c.env?.ENABLE_API_LOGGING !== 'false';
    if (!enableLogging) {
      await next();
      return;
    }

    const method = c.req.method;
    const sanitizedUrl = sanitizeUrl(c.req.url);
    const startTime = Date.now();

    // ── Request side ──────────────────────────────────────────────
    const contentType = c.req.header('content-type');
    const reqMeta: Record<string, unknown> = {
      headers: sanitizeHeaders((c.req.header() ?? {}) as Record<string, string>),
      query: sanitizeQuery(c.req.query()),
    };

    if (contentType && contentType.includes('application/json') && c.req.raw.body) {
      try {
        const clonedReq = c.req.raw.clone(); // clone before read — handler stream untouched
        const raw = await clonedReq.text();
        try {
          reqMeta.body = extractSafeBodyFields(JSON.parse(raw)); // allowlisted fields only
        } catch {
          reqMeta.body = UNPARSEABLE_BODY; // omit marker, never raw text
        }
      } catch (e) {
        logger.warn(`Failed to read request body for logging: ${method} ${sanitizedUrl}`, {
          error: e instanceof Error ? e.name : 'unknown',
        });
      }
    }
    logger.info(`[API Request] ${method} ${sanitizedUrl}`, reqMeta);

    // ── Response side ─────────────────────────────────────────────
    await next();
    const duration = Date.now() - startTime;

    const resMeta: Record<string, unknown> = { status: c.res.status };
    const resContentType = c.res.headers.get('content-type');
    if (c.res.body && resContentType && resContentType.includes('application/json')) {
      try {
        const bodyBytes = await c.res.arrayBuffer(); // buffer exactly once
        try {
          const text = new TextDecoder().decode(bodyBytes);
          resMeta.body = extractSafeBodyFields(JSON.parse(text));
        } catch {
          // JSON content-type but unparseable text: no body fields logged
        }
        // Rebuild: status/headers copied, byte-identical body for the real network client
        c.res = new Response(bodyBytes, c.res);
      } catch (e) {
        logger.warn('Failed to buffer response body for logging', {
          error: e instanceof Error ? e.name : 'unknown',
        });
      }
    }
    logger.info(
      `[API Response] ${method} ${sanitizedUrl} - ${c.res.status} (${duration}ms)`,
      resMeta,
    );
  };
};
