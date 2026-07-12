import type { MiddlewareHandler } from 'hono';
import { logger } from '@sonora/shared';

export const customLogger = (): MiddlewareHandler => {
  return async (c, next) => {
    const method = c.req.method;
    const url = c.req.url;
    const startTime = Date.now();

    // 1. Clonar y leer el body del Request
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
        parsedRequestBody = requestBody;
      }
    }

    logger.info(`[API Request] ${method} ${url}`, {
      headers: c.req.header(),
      body: parsedRequestBody,
    });

    await next();

    const duration = Date.now() - startTime;

    // 2. Clonar y leer el body del Response
    let responseBody = '';
    try {
      if (c.res && c.res.body) {
        const clonedRes = c.res.clone();
        responseBody = await clonedRes.text();
      }
    } catch (e) {
      logger.warn(`Failed to read response body for logging: ${method} ${url}`, e);
    }

    let parsedResponseBody: unknown;
    if (responseBody) {
      try {
        parsedResponseBody = c.res.headers.get('content-type')?.includes('application/json')
          ? JSON.parse(responseBody)
          : responseBody;
      } catch (e) {
        parsedResponseBody = responseBody;
      }
    }

    logger.info(`[API Response] ${method} ${url} - ${c.res.status} (${duration}ms)`, {
      status: c.res.status,
      body: parsedResponseBody,
    });
  };
};
