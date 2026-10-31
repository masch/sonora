import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { required } from '../required-message';

/**
 * The policy this helper owns: a custom message for a **missing** value, and zod's own
 * text for anything else.
 *
 * The negative half is the part worth pinning: replacing `required('X')` with
 * `error: 'X'` would keep every "missing" assertion green while silently relabelling a
 * `null` or a wrong type as "required", which is the one thing this helper exists to
 * prevent.
 */
const schema = z.object({ field: z.string(required('FIELD_REQUIRED')) });

function messageFor(input: unknown): string | undefined {
  const result = schema.safeParse(input);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('required', () => {
  it('applies the custom message when the value is missing', () => {
    expect(messageFor({})).toBe('FIELD_REQUIRED');
  });

  it('applies it when the key is present and undefined', () => {
    expect(messageFor({ field: undefined })).toBe('FIELD_REQUIRED');
  });

  it('leaves an explicit null to zod, so a present value is never called missing', () => {
    expect(messageFor({ field: null })).toBe('Invalid input: expected string, received null');
  });

  it('leaves a wrong type to zod as well', () => {
    expect(messageFor({ field: 42 })).toBe('Invalid input: expected string, received number');
  });

  it('raises no issue for a valid value', () => {
    expect(schema.safeParse({ field: 'ok' }).success).toBe(true);
  });
});
