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
export function validationHook(
  // Not generic: the hook never reads `data`, and a generic parameter here made the
  // schema type fail to flow through `zValidator`, so `c.req.valid()` collapsed to
  // `unknown` in the routes that destructure it.
  result:
    | { success: true; data: unknown }
    | {
        success: false;
        // `PropertyKey` is what zod 4 reports: an issue path may carry a symbol, and a
        // narrower type here makes the hook unassignable to `@hono/zod-validator`'s.
        error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> };
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
export const validateJson = <T extends z.ZodType>(schema: T) =>
  zValidator('json', schema, validationHook);

/**
 * Validates incoming query parameters against a Zod schema using the canonical
 * problem details validation hook. Inferred types flow automatically to `c.req.valid('query')`.
 */
export const validateQuery = <T extends z.ZodType>(schema: T) =>
  zValidator('query', schema, validationHook);
