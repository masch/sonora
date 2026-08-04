import { describe, expect, it } from 'vitest';
import {
  BODY_FIELD_ALLOWLIST,
  extractSafeBodyFields,
  sanitizeHeaders,
  sanitizeQuery,
  sanitizeUrl,
  UNPARSEABLE_BODY,
  UNPARSEABLE_URL,
} from '../log-redaction';

describe('sanitizeUrl', () => {
  it('strips the query string from an absolute URL, including embedded signed sub-URLs', () => {
    expect(
      sanitizeUrl(
        'https://api.example.com/audio/play?deviceId=abc123&url=https%3A%2F%2Fsigned.example.com%2Fa.mp3%3Ftoken%3Dxyz',
      ),
    ).toBe('https://api.example.com/audio/play');
  });

  it('leaves query-less URLs unchanged', () => {
    expect(sanitizeUrl('https://api.example.com/payments/status/123')).toBe(
      'https://api.example.com/payments/status/123',
    );
  });

  it('falls back to a non-sensitive constant for unparseable input', () => {
    const result = sanitizeUrl('not a url at all ?token=secret');
    expect(result).toBe(UNPARSEABLE_URL);
    expect(result).not.toContain('not a url at all');
    expect(result).not.toContain('token=secret');
  });

  it('strips the query string from relative paths', () => {
    expect(sanitizeUrl('/payments/status/123?email=buyer@example.com')).toBe(
      '/payments/status/123',
    );
  });

  it('preserves custom schemes with host, stripping the query', () => {
    expect(sanitizeUrl('sonora://app/return/success/uuid?extra=1')).toBe(
      'sonora://app/return/success/uuid',
    );
  });

  it('preserves custom schemes without a host', () => {
    expect(sanitizeUrl('sonora:return/success')).toBe('sonora:return/success');
  });

  it('returns an empty string for empty input', () => {
    expect(sanitizeUrl('')).toBe('');
    expect(sanitizeUrl(undefined as unknown as string)).toBe('');
  });

  it('strips userinfo from absolute URLs', () => {
    expect(sanitizeUrl('https://user:pass@api.example.com/path')).toBe(
      'https://api.example.com/path',
    );
  });
});

describe('sanitizeHeaders', () => {
  it('returns exactly the allowlisted headers, case-insensitively', () => {
    const result = sanitizeHeaders({
      'Content-Type': 'application/json',
      'User-Agent': 'SonoraApp/1.0',
      'X-Request-Id': 'req-123',
      Authorization: 'Bearer secret-token',
      Cookie: 'session=abc',
      'X-Api-Key': 'key123',
      'X-Device-Id': 'dev-1',
    });
    expect(result).toEqual({
      'content-type': 'application/json',
      'user-agent': 'SonoraApp/1.0',
      'x-request-id': 'req-123',
    });
  });

  it('returns an empty object when no allowlisted headers are present', () => {
    expect(sanitizeHeaders({ authorization: 'Bearer x', cookie: 'a=b' })).toEqual({});
    expect(sanitizeHeaders({})).toEqual({});
  });
});

describe('extractSafeBodyFields', () => {
  it('extracts only allowlisted top-level fields from a body', () => {
    const result = extractSafeBodyFields({
      name: 'masch',
      email: 'buyer@example.com',
      purchaseId: 'uuid-1',
      status: 'pending',
      metadata: { redirectUrl: 'https://example.com/r?signed=1' },
    });
    expect(result).toEqual({ purchaseId: 'uuid-1', status: 'pending' });
  });

  it('marks nested object values at allowlisted keys as <object>', () => {
    expect(extractSafeBodyFields({ status: { nested: true }, purchaseId: 'x' })).toEqual({
      status: '<object>',
      purchaseId: 'x',
    });
  });

  it('marks array values at allowlisted keys as <array>', () => {
    expect(extractSafeBodyFields({ event: ['a', 'b'] })).toEqual({ event: '<array>' });
  });

  it('returns {} for array bodies', () => {
    expect(extractSafeBodyFields([{ purchaseId: 'x', status: 'ok' }])).toEqual({});
  });

  it('returns {} for non-object JSON values', () => {
    expect(extractSafeBodyFields('a string')).toEqual({});
    expect(extractSafeBodyFields(123)).toEqual({});
  });

  it('no-ops on undefined, null, and empty objects', () => {
    expect(extractSafeBodyFields(undefined)).toEqual({});
    expect(extractSafeBodyFields(null)).toEqual({});
    expect(extractSafeBodyFields({})).toEqual({});
  });

  it('passes through all allowlisted opaque identifiers', () => {
    expect(
      extractSafeBodyFields({
        purchaseId: 'p-1',
        status: 'approved',
        event: 'approved',
        providerPaymentId: '123456',
        merchant_order_id: 'm-1',
        externalReference: 'p-1',
        type: 'payment',
      }),
    ).toEqual({
      purchaseId: 'p-1',
      status: 'approved',
      event: 'approved',
      providerPaymentId: '123456',
      merchant_order_id: 'm-1',
      externalReference: 'p-1',
      type: 'payment',
    });
  });

  it('exports the locked 7-field allowlist', () => {
    expect([...BODY_FIELD_ALLOWLIST].sort()).toEqual(
      [
        'purchaseId',
        'status',
        'event',
        'providerPaymentId',
        'merchant_order_id',
        'externalReference',
        'type',
      ].sort(),
    );
    expect(UNPARSEABLE_BODY).toBe('<unparseable-body>');
  });
});

describe('sanitizeQuery', () => {
  it('keeps only page, limit, and sync', () => {
    const result = sanitizeQuery({
      page: '2',
      limit: '10',
      sync: 'true',
      email: 'buyer@example.com',
      'data.id': '987',
      deviceId: 'dev-1',
      token: 'abc',
    });
    expect(result).toEqual({ page: '2', limit: '10', sync: 'true' });
  });

  it('returns {} when no allowlisted params are present', () => {
    expect(sanitizeQuery({ token: 'abc', email: 'x@y.z' })).toEqual({});
    expect(sanitizeQuery({})).toEqual({});
  });
});
