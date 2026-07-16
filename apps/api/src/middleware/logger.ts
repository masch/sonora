import { logger } from '@sonora/shared';
import type { MiddlewareHandler } from 'hono';

export const customLogger = (): MiddlewareHandler => {
  return async (c, next) => {
    const enableLogging = c.env?.ENABLE_API_LOGGING !== 'false';
    if (!enableLogging) {
      await next();
      return;
    }

    const method = c.req.method;
    const url = c.req.url;
    const startTime = Date.now();

    let requestBody = '';
    try {
      const contentType = c.req.header('content-type');
      if (contentType && contentType.includes('application/json') && c.req.raw.body) {
        const clonedReq = c.req.raw.clone();
        requestBody = await clonedReq.text();
      }
    } catch (e) {
      logger.warn(`Failed to read request body for logging: ${method} ${url}`, e);
    }

    let parsedRequestBody: unknown;
    if (requestBody) {
      try {
        parsedRequestBody = JSON.parse(requestBody);
      } catch (e) {
        logger.warn(`Failed to parse JSON request body for logging: ${method} ${url}`, e);
        parsedRequestBody = requestBody;
      }
    }

    logger.info(`[API Request] ${method} ${url}`, {
      headers: c.req.header(),
      body: parsedRequestBody,
    });

    let responseBody: any = undefined;

    await next();

    const duration = Date.now() - startTime;

    // Buffer and reconstruct the response body to log it without draining/locking the stream
    if (c.res && c.res.body) {
      const contentType = c.res.headers.get('content-type');
      if (
        contentType &&
        (contentType.includes('application/json') || contentType.includes('text/'))
      ) {
        try {
          const bodyBytes = await c.res.arrayBuffer();
          const text = new TextDecoder().decode(bodyBytes);
          try {
            responseBody = JSON.parse(text);
          } catch {
            responseBody = text;
          }
          // Reconstruct response using the buffered bodyBytes to prevent stream drainage/locking
          c.res = new Response(bodyBytes, c.res);
        } catch (e) {
          logger.warn('Failed to buffer response body for logging', e);
        }
      }
    }

    logger.info(`[API Response] ${method} ${url} - ${c.res.status} (${duration}ms)`, {
      status: c.res.status,
      body: responseBody,
    });
  };
};
