import type { Context } from 'hono';
import { ERRORS } from './problem-details';
import type { ProblemDetails } from './problem-details';

export type { ProblemDetails };

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
