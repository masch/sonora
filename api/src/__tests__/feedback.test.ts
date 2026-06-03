import { describe, it, expect } from 'vitest';
import app from '../index';

describe('POST /feedback', () => {
  it('returns 422 for empty body', async () => {
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { status: string; errors: string[] };
    expect(body.status).toBe('error');
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it('returns 422 for missing required fields', async () => {
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: 'trip-1' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { status: string; errors: string[] };
    expect(body.status).toBe('error');
    expect(body.errors).toContain('message is required and must be a non-empty string');
  });

  it('returns 422 for empty message', async () => {
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId: 'trip-1',
        message: '',
        idempotencyKey: 'key-1',
        createdAt: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('error');
  });

  it('returns 201 for valid feedback', async () => {
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId: 'trip-1',
        message: 'Great trail!',
        idempotencyKey: 'test-key-1',
        createdAt: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('returns 201 for duplicate idempotencyKey (no KV binding = no dedup)', async () => {
    // Without a KV binding, the server cannot dedup — it returns 201 both times
    const payload = {
      tripId: 'trip-1',
      message: 'Duplicate test',
      idempotencyKey: 'test-key-duplicate',
      createdAt: new Date().toISOString(),
    };

    const res1 = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(res1.status).toBe(201);

    const res2 = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // Without KV, both requests succeed (409 requires KV for dedup)
    expect(res2.status).toBe(201);
  });

  it('returns 409 for duplicate idempotencyKey with KV binding', async () => {
    const kvStore = new Map<string, string>();
    const mockEnv = {
      FEEDBACK_STORE: {
        get: async (key: string) => kvStore.get(key) ?? null,
        put: async (key: string, value: string, _options?: unknown) => {
          kvStore.set(key, value);
        },
      },
      FEEDBACK_MAX_LENGTH: '1000',
    };

    const makeReq = (idempotencyKey: string) =>
      new Request('http://localhost/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: 'trip-1',
          message: 'First attempt',
          idempotencyKey,
          createdAt: new Date().toISOString(),
        }),
      });

    // First request — should succeed (201)
    const res1 = await app.fetch(makeReq('dedup-key-1'), mockEnv as never);
    expect(res1.status).toBe(201);

    // Second request with same key — should return 409
    const res2 = await app.fetch(makeReq('dedup-key-1'), mockEnv as never);
    expect(res2.status).toBe(409);
    const body2 = (await res2.json()) as { status: string };
    expect(body2.status).toBe('duplicate');
  });

  it('rejects messages over 1000 characters', async () => {
    const longMessage = 'x'.repeat(1001);
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId: 'trip-1',
        message: longMessage,
        idempotencyKey: 'test-key-long',
        createdAt: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { status: string; errors: string[] };
    expect(body.status).toBe('error');
    expect(body.errors[0]).toContain('1000');
  });
});
