import { describe, it, expect } from 'vitest';
import {
  CreatePaymentBodySchema,
  WebhookBodySchema,
  LogAccessBodySchema,
  EmailQuerySchema,
} from '../schemas/payments';
import { AudioUploadBodySchema } from '../schemas/audio';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('CreatePaymentBodySchema', () => {
  it('accepts valid payload with only experienceId', () => {
    const result = CreatePaymentBodySchema.safeParse({ experienceId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it('accepts payload with experienceId and redirectUrl', () => {
    const result = CreatePaymentBodySchema.safeParse({
      experienceId: VALID_UUID,
      redirectUrl: 'https://example.com/callback',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing experienceId', () => {
    const result = CreatePaymentBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID experienceId', () => {
    const result = CreatePaymentBodySchema.safeParse({ experienceId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid redirectUrl', () => {
    const result = CreatePaymentBodySchema.safeParse({
      experienceId: VALID_UUID,
      redirectUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('ignores extra fields (Zod default — no .strict())', () => {
    const result = CreatePaymentBodySchema.safeParse({
      experienceId: VALID_UUID,
      extraField: 'should-be-ignored',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('extraField');
    }
  });
});

describe('WebhookBodySchema', () => {
  const validPayload = { type: 'payment', data: { id: '123' } };

  it('accepts valid MP webhook payload', () => {
    const result = WebhookBodySchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('accepts payload without optional fields', () => {
    const result = WebhookBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts payload with action field', () => {
    const result = WebhookBodySchema.safeParse({ action: 'payment.updated' });
    expect(result.success).toBe(true);
  });

  it('allows extra fields via passthrough', () => {
    const result = WebhookBodySchema.safeParse({
      ...validPayload,
      undocumentedField: 'should-be-allowed',
      anotherExtra: 42,
    });
    expect(result.success).toBe(true);
  });

  it('stringifies data.id when present', () => {
    const result = WebhookBodySchema.safeParse({ data: { id: '456' } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data?.id).toBe('456');
    }
  });

  it('accepts data without id', () => {
    const result = WebhookBodySchema.safeParse({ data: {} });
    expect(result.success).toBe(true);
  });

  it('rejects non-string type', () => {
    const result = WebhookBodySchema.safeParse({ type: 123 });
    expect(result.success).toBe(false);
  });
});

describe('LogAccessBodySchema', () => {
  const validPayload = { source: 'free' as const };

  it('accepts valid minimal payload', () => {
    const result = LogAccessBodySchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('accepts source, email, and platform all provided', () => {
    const result = LogAccessBodySchema.safeParse({
      source: 'paid',
      email: 'user@example.com',
      platform: 'ios',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null email', () => {
    const result = LogAccessBodySchema.safeParse({ source: 'free', email: null });
    expect(result.success).toBe(true);
  });

  it('accepts null platform', () => {
    const result = LogAccessBodySchema.safeParse({ source: 'free', platform: null });
    expect(result.success).toBe(true);
  });

  it('rejects invalid source', () => {
    const result = LogAccessBodySchema.safeParse({ source: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = LogAccessBodySchema.safeParse({ source: 'free', email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid platform', () => {
    const result = LogAccessBodySchema.safeParse({ source: 'free', platform: 'windows' });
    expect(result.success).toBe(false);
  });

  it('rejects missing source', () => {
    const result = LogAccessBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts all three valid sources', () => {
    for (const source of ['free', 'paid', 'restored'] as const) {
      const result = LogAccessBodySchema.safeParse({ source });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all three valid platforms', () => {
    for (const platform of ['ios', 'android', 'web'] as const) {
      const result = LogAccessBodySchema.safeParse({ source: 'free', platform });
      expect(result.success).toBe(true);
    }
  });
});

describe('EmailQuerySchema', () => {
  it('accepts valid email', () => {
    const result = EmailQuerySchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects missing email', () => {
    const result = EmailQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = EmailQuerySchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('returns custom error message for invalid email', () => {
    const result = EmailQuerySchema.safeParse({ email: 'bad' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('A valid email is required');
    }
  });
});

describe('AudioUploadBodySchema', () => {
  it('accepts valid File and key', () => {
    const file = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });
    const result = AudioUploadBodySchema.safeParse({ file, key: 'path/to/file.mp3' });
    expect(result.success).toBe(true);
  });

  it('rejects missing key', () => {
    const file = new File(['audio data'], 'test.mp3');
    const result = AudioUploadBodySchema.safeParse({ file });
    expect(result.success).toBe(false);
  });

  it('rejects empty key', () => {
    const file = new File(['audio data'], 'test.mp3');
    const result = AudioUploadBodySchema.safeParse({ file, key: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing file', () => {
    const result = AudioUploadBodySchema.safeParse({ key: 'path/to/file.mp3' });
    expect(result.success).toBe(false);
  });

  it('rejects non-File file value', () => {
    const result = AudioUploadBodySchema.safeParse({ file: 'not-a-file', key: 'path' });
    expect(result.success).toBe(false);
  });

  it('rejects non-string key', () => {
    const file = new File(['data'], 'test.mp3');
    const result = AudioUploadBodySchema.safeParse({ file, key: 123 });
    expect(result.success).toBe(false);
  });
});
