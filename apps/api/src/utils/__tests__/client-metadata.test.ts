import type { Context } from 'hono';
import { describe, expect, it } from 'vitest';
import { getClientMetadata, UNKNOWN_CLIENT_METADATA } from '../client-metadata';

function createMockContext(headers: Record<string, string | undefined>): Context {
  return {
    req: {
      header: (name: string) => headers[name.toLowerCase()],
    },
  } as unknown as Context;
}

describe('getClientMetadata', () => {
  it('extracts cf-connecting-ip and user-agent when both are present', () => {
    const c = createMockContext({
      'cf-connecting-ip': '198.51.100.1',
      'user-agent': 'SonoraApp/1.0.0',
    });

    const result = getClientMetadata(c);
    expect(result).toEqual({
      ipAddress: '198.51.100.1',
      userAgent: 'SonoraApp/1.0.0',
    });
  });

  it('falls back to x-forwarded-for first entry when cf-connecting-ip is absent', () => {
    const c = createMockContext({
      'x-forwarded-for': '203.0.113.50, 70.41.3.18',
      'user-agent': 'Mozilla/5.0',
    });

    const result = getClientMetadata(c);
    expect(result).toEqual({
      ipAddress: '203.0.113.50',
      userAgent: 'Mozilla/5.0',
    });
  });

  it('prefers cf-connecting-ip over x-forwarded-for', () => {
    const c = createMockContext({
      'cf-connecting-ip': '198.51.100.1',
      'x-forwarded-for': '203.0.113.50',
      'user-agent': 'TestClient/1.0',
    });

    const result = getClientMetadata(c);
    expect(result.ipAddress).toBe('198.51.100.1');
  });

  it('falls back to unknown when all headers are missing', () => {
    const c = createMockContext({});

    const result = getClientMetadata(c);
    expect(result).toEqual({
      ipAddress: UNKNOWN_CLIENT_METADATA,
      userAgent: UNKNOWN_CLIENT_METADATA,
    });
  });

  it('falls back to unknown when headers are empty or whitespace only', () => {
    const c = createMockContext({
      'cf-connecting-ip': '   ',
      'x-forwarded-for': '   ',
      'user-agent': '   ',
    });

    const result = getClientMetadata(c);
    expect(result).toEqual({
      ipAddress: UNKNOWN_CLIENT_METADATA,
      userAgent: UNKNOWN_CLIENT_METADATA,
    });
  });
});
