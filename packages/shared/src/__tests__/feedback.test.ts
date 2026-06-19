import { describe, it, expect } from 'vitest';
import { FeedbackPostBodySchema, type FeedbackPostBody, type FeedbackResponse } from '../feedback';

describe('FeedbackPostBodySchema', () => {
  const validPayload: FeedbackPostBody = {
    trackId: 'track_123',
    message: 'La app funciona muy bien!',
    idempotencyKey: 'uuid-abc-123',
    createdAt: '2026-06-15T10:00:00Z',
  };

  describe('valid inputs', () => {
    it('accepts a valid payload', () => {
      const result = FeedbackPostBodySchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('preserves all fields on parse', () => {
      const result = FeedbackPostBodySchema.parse(validPayload);
      expect(result).toEqual(validPayload);
    });
  });

  describe('trackId', () => {
    it('rejects missing trackId', () => {
      const { trackId, ...rest } = validPayload;
      const result = FeedbackPostBodySchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects empty trackId', () => {
      const result = FeedbackPostBodySchema.safeParse({ ...validPayload, trackId: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('message', () => {
    it('rejects missing message', () => {
      const { message, ...rest } = validPayload;
      const result = FeedbackPostBodySchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects empty message', () => {
      const result = FeedbackPostBodySchema.safeParse({ ...validPayload, message: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('idempotencyKey', () => {
    it('rejects missing idempotencyKey', () => {
      const { idempotencyKey, ...rest } = validPayload;
      const result = FeedbackPostBodySchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects empty idempotencyKey', () => {
      const result = FeedbackPostBodySchema.safeParse({ ...validPayload, idempotencyKey: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('createdAt', () => {
    it('rejects missing createdAt', () => {
      const { createdAt, ...rest } = validPayload;
      const result = FeedbackPostBodySchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects empty createdAt', () => {
      const result = FeedbackPostBodySchema.safeParse({ ...validPayload, createdAt: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('type coercion', () => {
    it('rejects non-string trackId', () => {
      const result = FeedbackPostBodySchema.safeParse({ ...validPayload, trackId: 123 });
      expect(result.success).toBe(false);
    });
  });

  describe('error messages', () => {
    it('includes field name in required error', () => {
      const result = FeedbackPostBodySchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('trackId'))).toBe(true);
        expect(result.error.issues.some((i) => i.path.includes('message'))).toBe(true);
        expect(result.error.issues.some((i) => i.path.includes('idempotencyKey'))).toBe(true);
        expect(result.error.issues.some((i) => i.path.includes('createdAt'))).toBe(true);
      }
    });
  });
});

describe('FeedbackResponse', () => {
  it('is a valid TypeScript interface (compile-time check)', () => {
    const ok: FeedbackResponse = { status: 'ok' };
    const duplicate: FeedbackResponse = { status: 'duplicate' };
    const error: FeedbackResponse = { status: 'error', errors: ['something went wrong'] };
    expect(ok.status).toBe('ok');
    expect(duplicate.status).toBe('duplicate');
    expect(error.errors).toHaveLength(1);
  });
});
