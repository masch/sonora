import { describe, it, expect } from 'vitest';
import {
  LEAD_SOURCES,
  LeadPostBodySchema,
  type LeadPostBody,
  type LeadResponse,
  type LeadSource,
} from '../index';

describe('LEAD_SOURCES enum', () => {
  it('contains expected sources', () => {
    expect(LEAD_SOURCES).toContain('track_detail');
    expect(LEAD_SOURCES).toContain('trip_detail');
    expect(LEAD_SOURCES.length).toBe(2);
  });
});

describe('LeadPostBodySchema', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';

  describe('valid payloads', () => {
    it('accepts payload with email, experienceId, and track_detail source', () => {
      const payload: LeadPostBody = {
        email: 'listener@sonora.app',
        experienceId: validUuid,
        source: 'track_detail',
      };
      const result = LeadPostBodySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(payload);
      }
    });

    it('accepts trip_detail source with optional experienceId omitted', () => {
      const payload: LeadPostBody = {
        email: 'walker@sonora.app',
        source: 'trip_detail',
      };
      const result = LeadPostBodySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('walker@sonora.app');
        expect(result.data.source).toBe('trip_detail');
        expect(result.data.experienceId).toBeUndefined();
      }
    });

    it('accepts uppercase email', () => {
      const result = LeadPostBodySchema.safeParse({
        email: 'USER@DOMAIN.COM',
        source: 'track_detail',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('invalid payloads', () => {
    it('rejects missing email', () => {
      const result = LeadPostBodySchema.safeParse({ source: 'track_detail' });
      expect(result.success).toBe(false);
    });

    it('rejects empty email', () => {
      const result = LeadPostBodySchema.safeParse({ email: '', source: 'track_detail' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email format', () => {
      const result = LeadPostBodySchema.safeParse({
        email: 'not-an-email',
        source: 'track_detail',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing source', () => {
      const result = LeadPostBodySchema.safeParse({
        email: 'user@example.com',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid source', () => {
      const result = LeadPostBodySchema.safeParse({
        email: 'user@example.com',
        source: 'invalid_source',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid experienceId (non-UUID)', () => {
      const result = LeadPostBodySchema.safeParse({
        email: 'user@example.com',
        experienceId: 'not-a-uuid',
        source: 'track_detail',
      });
      expect(result.success).toBe(false);
    });

    it('rejects email exceeding maximum length', () => {
      const longEmail = `${'a'.repeat(250)}@example.com`;
      const result = LeadPostBodySchema.safeParse({
        email: longEmail,
        source: 'track_detail',
      });
      expect(result.success).toBe(false);
    });
  });
});
