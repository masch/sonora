import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateMercadoPagoSignature } from '../payments/signature';

const TEST_SECRET = 'test-secret-123';
const TEST_DATA_ID = '987654';
const TEST_REQUEST_ID = 'req-abc-123';

async function computeSignature(
  secret: string,
  dataId: string,
  requestId: string,
  ts: number,
): Promise<string> {
  const message = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('validateMercadoPagoSignature', () => {
  it('returns valid for a correctly signed message', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const hmac = await computeSignature(TEST_SECRET, TEST_DATA_ID, TEST_REQUEST_ID, ts);
    const result = await validateMercadoPagoSignature(
      {
        'x-signature': `ts=${ts},v1=${hmac}`,
        'x-request-id': TEST_REQUEST_ID,
      },
      TEST_DATA_ID,
      TEST_SECRET,
    );
    expect(result.valid).toBe(true);
  });

  it('returns invalid for a tampered HMAC', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const hmac = await computeSignature(TEST_SECRET, TEST_DATA_ID, TEST_REQUEST_ID, ts);
    const tampered = 'f' + hmac.slice(1);
    const result = await validateMercadoPagoSignature(
      {
        'x-signature': `ts=${ts},v1=${tampered}`,
        'x-request-id': TEST_REQUEST_ID,
      },
      TEST_DATA_ID,
      TEST_SECRET,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('returns invalid when X-Signature header is missing', async () => {
    const result = await validateMercadoPagoSignature(
      { 'x-request-id': TEST_REQUEST_ID },
      TEST_DATA_ID,
      TEST_SECRET,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('X-Signature');
  });

  it('returns invalid when X-Signature header is malformed', async () => {
    const result = await validateMercadoPagoSignature(
      {
        'x-signature': 'this-is-not-valid',
        'x-request-id': TEST_REQUEST_ID,
      },
      TEST_DATA_ID,
      TEST_SECRET,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Malformed');
  });

  it('returns invalid when data.id is empty', async () => {
    const result = await validateMercadoPagoSignature(
      { 'x-signature': 'ts=12345,v1=abc', 'x-request-id': TEST_REQUEST_ID },
      '',
      TEST_SECRET,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('data.id');
  });

  it('returns invalid when x-request-id header is missing', async () => {
    const result = await validateMercadoPagoSignature(
      { 'x-signature': 'ts=12345,v1=abc' },
      TEST_DATA_ID,
      TEST_SECRET,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('x-request-id');
  });

  describe('replay protection', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('accepts a signature within the 5-minute window', async () => {
      const nowMs = Date.now();
      const ts = Math.floor((nowMs - 60_000) / 1000); // 1 minute ago, in seconds
      const hmac = await computeSignature(TEST_SECRET, TEST_DATA_ID, TEST_REQUEST_ID, ts);
      vi.setSystemTime(nowMs);

      const result = await validateMercadoPagoSignature(
        {
          'x-signature': `ts=${ts},v1=${hmac}`,
          'x-request-id': TEST_REQUEST_ID,
        },
        TEST_DATA_ID,
        TEST_SECRET,
      );
      expect(result.valid).toBe(true);
    });

    it('rejects an expired signature (>5 minutes old)', async () => {
      const nowMs = Date.now();
      const ts = Math.floor((nowMs - 360_000) / 1000); // 6 minutes ago, in seconds
      const hmac = await computeSignature(TEST_SECRET, TEST_DATA_ID, TEST_REQUEST_ID, ts);
      vi.setSystemTime(nowMs);

      const result = await validateMercadoPagoSignature(
        {
          'x-signature': `ts=${ts},v1=${hmac}`,
          'x-request-id': TEST_REQUEST_ID,
        },
        TEST_DATA_ID,
        TEST_SECRET,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('timestamp');
    });

    it('rejects a future signature (>5 minutes ahead)', async () => {
      const nowMs = Date.now();
      const ts = Math.floor((nowMs + 360_000) / 1000); // 6 minutes in the future, in seconds
      const hmac = await computeSignature(TEST_SECRET, TEST_DATA_ID, TEST_REQUEST_ID, ts);
      vi.setSystemTime(nowMs);

      const result = await validateMercadoPagoSignature(
        {
          'x-signature': `ts=${ts},v1=${hmac}`,
          'x-request-id': TEST_REQUEST_ID,
        },
        TEST_DATA_ID,
        TEST_SECRET,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('timestamp');
    });
  });
});
