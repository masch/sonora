import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app, { setDbClient } from '../index';

interface MockDb {
  insert: () => {
    values: (values: { idempotencyKey: string }) => Promise<void>;
  };
  _inserted: Map<string, true>;
  _insertCalls: number;
  _reset: () => void;
}

function createMockDb(): MockDb {
  const store = new Map<string, true>();
  let insertCalls = 0;
  return {
    insert: () => ({
      values: async (values: { idempotencyKey: string }) => {
        insertCalls++;
        if (store.has(values.idempotencyKey)) {
          const err = new Error('duplicate key value violates unique constraint') as Error & {
            code: string;
          };
          err.code = '23505';
          throw err;
        }
        store.set(values.idempotencyKey, true);
      },
    }),
    _inserted: store,
    get _insertCalls() {
      return insertCalls;
    },
    _reset: () => {
      store.clear();
      insertCalls = 0;
    },
  };
}

describe('POST /feedback', () => {
  beforeEach(() => {
    setDbClient(null);
  });

  afterEach(() => {
    setDbClient(null);
  });
  it('returns 422 for empty body', async () => {
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(body).toHaveProperty('detail', 'The request contains invalid fields.');
    expect(body).toHaveProperty('status', 422);
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(errors.length).toBeGreaterThan(0);
  });

  it('returns 500 for malformed JSON body (zValidator does not catch parse errors)', async () => {
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"invalid-json',
    });
    // zValidator does not handle JSON parse errors — they fall through to Hono's default error handler (500)
    expect(res.status).toBe(500);
  });

  it('returns 422 for missing required fields', async () => {
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experienceId: 'track-1' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(body).toHaveProperty('detail', 'The request contains invalid fields.');
    expect(body).toHaveProperty('status', 422);
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(errors.some((e) => (e.message as string).includes('message'))).toBe(true);
  });

  it('returns 422 for empty message', async () => {
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experienceId: 'track-1',
        message: '',
        idempotencyKey: 'key-1',
        createdAt: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(body).toHaveProperty('detail', 'The request contains invalid fields.');
    expect(body).toHaveProperty('status', 422);
  });

  it('returns 201 for valid feedback', async () => {
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experienceId: 'track-1',
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
      experienceId: 'track-1',
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
    };

    const makeReq = (idempotencyKey: string) =>
      new Request('http://localhost/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experienceId: 'track-1',
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
    const body2 = (await res2.json()) as { code: string };
    expect(body2.code).toBe('DUPLICATE_REQUEST');
  });

  it('rejects messages over 1000 characters', async () => {
    const longMessage = 'x'.repeat(1001);
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experienceId: 'track-1',
        message: longMessage,
        idempotencyKey: 'test-key-long',
        createdAt: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(body).toHaveProperty('detail', 'The request contains invalid fields.');
    expect(body).toHaveProperty('status', 422);
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(errors[0].message).toContain('1000');
  });

  describe('DB persistence', () => {
    let mockDb: MockDb;

    beforeEach(() => {
      mockDb = createMockDb();
      setDbClient(mockDb as never);
    });

    afterEach(() => {
      setDbClient(null);
      mockDb._reset();
    });

    it('stores accepted feedback in DB', async () => {
      const res = await app.request('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experienceId: 'track-2',
          message: 'Amazing hike!',
          idempotencyKey: 'db-test-key-1',
          createdAt: new Date().toISOString(),
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe('ok');
      expect(mockDb._insertCalls).toBe(1);
    });

    it('returns 409 for duplicate via UNIQUE constraint (no KV)', async () => {
      const payload = {
        experienceId: 'track-2',
        message: 'Double post test',
        idempotencyKey: 'unique-dup-key',
        createdAt: new Date().toISOString(),
      };

      const res1 = await app.request('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      expect(res1.status).toBe(201);

      // Mock DB already has the key — should get 409 even without KV
      const res2 = await app.request('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      expect(res2.status).toBe(409);
      const body2 = (await res2.json()) as { code: string };
      expect(body2.code).toBe('DUPLICATE_REQUEST');
    });

    it('returns 409 for KV miss, DB hit', async () => {
      // Pre-seed the mock DB so the key already exists
      await mockDb.insert().values({ idempotencyKey: 'kv-miss-db-hit' });

      const res = await app.request('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experienceId: 'track-2',
          message: 'KV misses but DB has it',
          idempotencyKey: 'kv-miss-db-hit',
          createdAt: new Date().toISOString(),
        }),
      });
      // DB catches the duplicate — 409 even though KV never had it
      expect(res.status).toBe(409);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('DUPLICATE_REQUEST');
    });

    it('returns 500 when DB throws a non-unique error', async () => {
      // Mock DB that throws a connection error (not unique violation)
      const brokenDb = {
        insert: () => ({
          values: async () => {
            throw new Error('connection refused');
          },
        }),
      };
      setDbClient(brokenDb as never);

      const res = await app.request('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experienceId: 'track-3',
          message: 'This will blow up',
          idempotencyKey: 'db-error-key',
          createdAt: new Date().toISOString(),
        }),
      });
      expect(res.status).toBe(500);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toHaveProperty('code', 'INTERNAL_ERROR');
      expect(body).toHaveProperty('detail', 'An unexpected error occurred');
      expect(body).toHaveProperty('status', 500);
    });

    it('returns 409 from KV fast-path without calling DB insert', async () => {
      const kvStore = new Map<string, string>();
      const mockEnv = {
        FEEDBACK_STORE: {
          get: async (key: string) => kvStore.get(key) ?? null,
          put: async (key: string, value: string, _options?: unknown) => {
            kvStore.set(key, value);
          },
        },
      };

      const makeReq = (idempotencyKey: string) =>
        new Request('http://localhost/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            experienceId: 'track-2',
            message: 'KV already has this',
            idempotencyKey,
            createdAt: new Date().toISOString(),
          }),
        });

      // First request — both KV and DB should succeed
      const res1 = await app.fetch(makeReq('kv-fastpath-key'), mockEnv as never);
      expect(res1.status).toBe(201);
      expect(mockDb._insertCalls).toBe(1);

      // Second request with same key — KV catches it before DB
      const insertCallsBefore = mockDb._insertCalls;
      const res2 = await app.fetch(makeReq('kv-fastpath-key'), mockEnv as never);
      expect(res2.status).toBe(409);
      // Verify DB insert was NOT called — KV fast-path prevented it
      expect(mockDb._insertCalls).toBe(insertCallsBefore);
    });

    it('returns 201 when coordinates are provided and valid', async () => {
      const res = await app.request('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experienceId: 'track-2',
          message: 'Hike with GPS coords!',
          idempotencyKey: 'db-test-key-gps-1',
          createdAt: new Date().toISOString(),
          latitude: -32.1234,
          longitude: -64.5678,
        }),
      });
      expect(res.status).toBe(201);
    });
  });

  describe('GET /feedback', () => {
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        select: () => ({
          from: async () => [
            {
              id: '1',
              experienceId: 'track-1',
              message: 'Great track',
              idempotencyKey: 'test-key-get-1',
              createdAt: new Date('2026-06-22T10:00:00Z'),
              latitude: -32.5,
              longitude: -64.2,
            },
          ],
        }),
      };
      setDbClient(mockDb as never);
    });

    afterEach(() => {
      setDbClient(null);
    });

    it('returns the list of feedback entries', async () => {
      const res = await app.request('/feedback', {
        method: 'GET',
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any[];
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe('test-key-get-1');
      expect(body[0].experienceId).toBe('track-1');
      expect(body[0].message).toBe('Great track');
      expect(body[0].latitude).toBe(-32.5);
      expect(body[0].longitude).toBe(-64.2);
    });
  });
});
