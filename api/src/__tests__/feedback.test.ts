import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
          tripId: 'trip-2',
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
        tripId: 'trip-2',
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
      const body2 = (await res2.json()) as { status: string };
      expect(body2.status).toBe('duplicate');
    });

    it('returns 409 for KV miss, DB hit', async () => {
      // Pre-seed the mock DB so the key already exists
      await mockDb.insert().values({ idempotencyKey: 'kv-miss-db-hit' });

      const res = await app.request('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: 'trip-2',
          message: 'KV misses but DB has it',
          idempotencyKey: 'kv-miss-db-hit',
          createdAt: new Date().toISOString(),
        }),
      });
      // DB catches the duplicate — 409 even though KV never had it
      expect(res.status).toBe(409);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe('duplicate');
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
          tripId: 'trip-3',
          message: 'This will blow up',
          idempotencyKey: 'db-error-key',
          createdAt: new Date().toISOString(),
        }),
      });
      expect(res.status).toBe(500);
      const body = (await res.json()) as { status: string; errors: string[] };
      expect(body.status).toBe('error');
      expect(body.errors[0]).toBe('Internal server error');
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
        FEEDBACK_MAX_LENGTH: '1000',
      };

      const makeReq = (idempotencyKey: string) =>
        new Request('http://localhost/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId: 'trip-2',
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
  });
});
