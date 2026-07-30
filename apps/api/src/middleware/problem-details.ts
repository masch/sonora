import { logger } from '@sonora/shared';

export interface ProblemDetails {
  code: string;
  detail: string;
  status: number;
  errors?: Array<{ path: string; message: string }>;
}

/** HTTP status code constants. */
export const HTTP = {
  FOUND: 302,
  OK: 200,
  PARTIAL_CONTENT: 206,
  RANGE_NOT_SATISFIABLE: 416,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  TOO_MANY_REQUESTS: 429,
} as const;

// ── Error constants ────────────────────────────────────────
// 5xx — detail siempre genérico, nunca filtra internals
// 4xx — detail específico, seguro para el cliente

export const ERRORS_5XX = {
  INTERNAL: {
    code: 'INTERNAL_ERROR',
    detail: 'An unexpected error occurred',
    status: HTTP.INTERNAL_SERVER_ERROR,
  } as const,
  DB_NOT_AVAILABLE: {
    code: 'DB_NOT_AVAILABLE',
    detail: 'An unexpected error occurred',
    status: HTTP.INTERNAL_SERVER_ERROR,
  } as const,
  PAYMENT_PROVIDER: {
    code: 'PAYMENT_PROVIDER',
    detail: 'An unexpected error occurred',
    status: HTTP.INTERNAL_SERVER_ERROR,
  } as const,
  STORAGE_NOT_CONFIG: {
    code: 'STORAGE_NOT_CONFIG',
    detail: 'An unexpected error occurred',
    status: HTTP.INTERNAL_SERVER_ERROR,
  } as const,
  UPLOAD_FAILED: {
    code: 'UPLOAD_FAILED',
    detail: 'An unexpected error occurred',
    status: HTTP.INTERNAL_SERVER_ERROR,
  } as const,
  SAVE_FAILED: {
    code: 'SAVE_FAILED',
    detail: 'An unexpected error occurred',
    status: HTTP.INTERNAL_SERVER_ERROR,
  } as const,
  MISCONFIG: {
    code: 'MISCONFIG',
    detail: 'An unexpected error occurred',
    status: HTTP.INTERNAL_SERVER_ERROR,
  } as const,
  FETCH_FAILED: {
    code: 'FETCH_FAILED',
    detail: 'An unexpected error occurred',
    status: HTTP.INTERNAL_SERVER_ERROR,
  } as const,
  STREAMING_FAILED: {
    code: 'STREAMING_FAILED',
    detail: 'An unexpected error occurred',
    status: HTTP.INTERNAL_SERVER_ERROR,
  } as const,
  JWT_SECRET_MISSING: {
    code: 'JWT_SECRET_MISSING',
    detail: 'An unexpected error occurred',
    status: HTTP.INTERNAL_SERVER_ERROR,
  } as const,
} as const;

export const ERRORS_4XX = {
  MISSING_KEY: {
    code: 'MISSING_KEY',
    detail: 'The key parameter is required.',
    status: HTTP.BAD_REQUEST,
  } as const,
  INVALID_LANG_CODE: {
    code: 'INVALID_LANG_CODE',
    detail: 'Invalid language code. Must be a 2-letter ISO 639-1 code.',
    status: HTTP.BAD_REQUEST,
  } as const,
  TOKEN_REQUIRED: {
    code: 'TOKEN_REQUIRED',
    detail: 'An access token is required.',
    status: HTTP.UNAUTHORIZED,
  } as const,
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    detail: 'Invalid or expired token.',
    status: HTTP.UNAUTHORIZED,
  } as const,
  NOT_FOUND: {
    code: 'NOT_FOUND',
    detail: 'The requested resource was not found.',
    status: HTTP.NOT_FOUND,
  } as const,
  EXPERIENCE_NOT_FOUND: {
    code: 'EXPERIENCE_NOT_FOUND',
    detail: 'The experience was not found.',
    status: HTTP.NOT_FOUND,
  } as const,
  PURCHASE_NOT_FOUND: {
    code: 'PURCHASE_NOT_FOUND',
    detail: 'The purchase was not found.',
    status: HTTP.NOT_FOUND,
  } as const,
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    detail: 'Valid authentication is required.',
    status: HTTP.UNAUTHORIZED,
  } as const,
  EXPERIENCE_IS_FREE: {
    code: 'EXPERIENCE_IS_FREE',
    detail: 'This experience is free.',
    status: HTTP.BAD_REQUEST,
  } as const,
  NO_PRICE_SET: {
    code: 'NO_PRICE_SET',
    detail: 'This experience has no price set.',
    status: HTTP.BAD_REQUEST,
  } as const,
  UNKNOWN_PROVIDER: {
    code: 'UNKNOWN_PROVIDER',
    detail: 'Unrecognized payment provider.',
    status: HTTP.BAD_REQUEST,
  } as const,
  MISSING_REFERENCE: {
    code: 'MISSING_REFERENCE',
    detail: 'Purchase reference is missing.',
    status: HTTP.BAD_REQUEST,
  } as const,
  VALIDATION: {
    code: 'VALIDATION_ERROR',
    detail: 'The request contains invalid fields.',
    status: HTTP.UNPROCESSABLE_ENTITY,
  } as const,
  MISSING_DATA_ID: {
    code: 'MISSING_DATA_ID',
    detail: 'The data.id query parameter is required.',
    status: HTTP.BAD_REQUEST,
  } as const,
  DEVICE_ID_REQUIRED: {
    code: 'DEVICE_ID_REQUIRED',
    detail: 'The X-Device-Id header is required.',
    status: HTTP.BAD_REQUEST,
  } as const,
  DUPLICATE_REQUEST: {
    code: 'DUPLICATE_REQUEST',
    detail: 'This request has already been processed.',
    status: HTTP.CONFLICT,
  } as const,
  INVALID_DEVICE_ID: {
    code: 'INVALID_DEVICE_ID',
    detail: 'The X-Device-Id header must be a non-empty string of 256 characters or fewer.',
    status: HTTP.BAD_REQUEST,
  } as const,
  PLATFORM_REQUIRED: {
    code: 'PLATFORM_REQUIRED',
    detail: 'The X-Device-Platform header is required.',
    status: HTTP.BAD_REQUEST,
  } as const,
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    detail: 'Too many requests. Please try again later.',
    status: HTTP.TOO_MANY_REQUESTS,
  } as const,
} as const;

export type ErrorConstant =
  (typeof ERRORS_5XX)[keyof typeof ERRORS_5XX] | (typeof ERRORS_4XX)[keyof typeof ERRORS_4XX];

// Flat merge for backward compat
export const ERRORS = { ...ERRORS_5XX, ...ERRORS_4XX } as const;

/**
 * Return an RFC 7807–style problem response.
 *
 * For 5xx errors the `detail` is always generic (never leaks internals).
 * If `logDetail` is provided it is logged server-side for debugging.
 */
export function problem(
  c: { json: <T>(body: T, status: number) => Response },
  err: ErrorConstant,
  logDetail?: string,
  errors?: Array<{ path: string; message: string }>,
): Response {
  if (logDetail) {
    logger.error(`[${err.code}] ${logDetail}`);
  }
  return c.json<ProblemDetails>({ ...err, errors }, err.status);
}

interface JsonContext {
  json: <T>(body: T, status: number) => Response;
}

/** Return a typed success response. Status defaults to 200. */
export function success<T>(c: JsonContext, data: T, status: number = 200): Response {
  return c.json(data, status);
}

/** Return a 201 Created response. */
export function created<T>(c: JsonContext, data: T): Response {
  return c.json(data, 201);
}

/**
 * Return a binary streaming response.
 * Used by audio range-request streaming — not a JSON response.
 */
export function streamResponse(
  body: ReadableStream | null,
  status: number,
  headers: Headers,
): Response {
  return new Response(body, { status, headers });
}

/** Range Not Satisfiable (416) with Content-Range header. */
export function rangeNotSatisfiable(objectSize: number): Response {
  return new Response(null, {
    status: HTTP.RANGE_NOT_SATISFIABLE,
    statusText: 'Range Not Satisfiable',
    headers: { 'Content-Range': `bytes */${objectSize}` },
  });
}
