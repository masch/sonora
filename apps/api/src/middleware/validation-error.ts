import { zValidator } from '@hono/zod-validator';
import type { z } from '@sonora/shared';
import type { Context } from 'hono';
import { ERRORS } from './problem-details';
import type { ProblemDetails } from './problem-details';

export type { ProblemDetails };

/**
 * Custom validation hook for `@hono/zod-validator`.
 *
 * Intercepts Zod validation results to standardize error responses according to RFC 7807 (Problem Details):
 * - On success: returns `void` to allow Hono to continue pipeline execution to the route handler.
 * - On failure: returns an HTTP 422 `Response` with code `VALIDATION_ERROR` and a mapped list of
 *   field paths and error messages, preventing default 400 responses.
 *
 * @param result The outcome of the Zod validation containing parsed data or validation issues.
 * @param c The active Hono execution Context.
 * @returns An RFC 7807 JSON Response with status 422 on validation failure, or void on success.
 */
export function validationHook<T>(
  result:
    | { success: true; data: T }
    | {
        success: false;
        error: { issues: Array<{ path: (string | number)[]; message: string }> };
      },
  c: Context,
): Response | void {
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    const base = ERRORS.VALIDATION;
    return c.json<ProblemDetails>(
      { code: base.code, detail: base.detail, status: base.status, errors },
      base.status,
    );
  }
}

/**
 * Validates incoming JSON request body against a Zod schema using the canonical
 * problem details validation hook. Inferred types flow automatically to `c.req.valid('json')`.
 */
export const validateJson = <T extends z.ZodSchema>(schema: T) =>
  zValidator('json', schema, validationHook);

/**
 * Validates incoming query parameters against a Zod schema using the canonical
 * problem details validation hook. Inferred types flow automatically to `c.req.valid('query')`.
 */
export const validateQuery = <T extends z.ZodSchema>(schema: T) =>
  zValidator('query', schema, validationHook);
