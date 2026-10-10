import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app, { setDbClient } from '../index';
import type { LeadResponse } from '@sonora/shared';

interface MockDb {
  insert: () => {
    values: (values: Record<string, unknown>) => Promise<void>;
  };
  select: () => {
    from: () => {
      where: () => {
        limit: () => Promise<Array<Record<string, unknown>>>;
      };
    };
  };
  _inserted: Array<Record<string, unknown>>;
  _reset: () => void;
}

function createMockDb(): MockDb {
  const inserted: Array<Record<string, unknown>> = [];
  return {
    insert: () => ({
      values: async (values: Record<string, unknown>) => {
        inserted.push(values);
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    }),
    _inserted: inserted,
    _reset: () => {
      inserted.length = 0;
    },
  };
}

describe('POST /leads', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    setDbClient(mockDb as unknown as import('../db').DbClient);
  });

  afterEach(() => {
    setDbClient(null);
  });

  it('returns 500 DB_NOT_AVAILABLE when db is not configured', async () => {
    setDbClient(null);
    const res = await app.request('/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        source: 'track_detail',
      }),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'DB_NOT_AVAILABLE');
  });

  it('returns 422 for empty body', async () => {
    const res = await app.request('/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(body).toHaveProperty('status', 422);
  });

  it('returns 422 for invalid email', async () => {
    const res = await app.request('/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email', source: 'track_detail' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('returns 422 for missing source', async () => {
    const res = await app.request('/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com' }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid source', async () => {
    const res = await app.request('/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', source: 'unknown_source' }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid experienceId', async () => {
    const res = await app.request('/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        source: 'track_detail',
        experienceId: 'not-a-uuid',
      }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 201 for valid lead with experienceId and source', async () => {
    const res = await app.request('/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'listener@sonora.app',
        source: 'track_detail',
        experienceId: validUuid,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as LeadResponse;
    expect(body.status).toBe('ok');
  });

  it('returns 201 for valid lead without experienceId', async () => {
    const res = await app.request('/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'listener@sonora.app',
        source: 'trip_detail',
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as LeadResponse;
    expect(body.status).toBe('ok');
  });

  it('inserts record into database when db client is available', async () => {
    const mockDb = createMockDb();
    setDbClient(mockDb as unknown as import('../db').DbClient);

    const res = await app.request('/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'Test@Example.Com',
        source: 'track_detail',
        experienceId: validUuid,
      }),
    });

    expect(res.status).toBe(201);
    expect(mockDb._inserted.length).toBe(1);
    expect(mockDb._inserted[0]).toMatchObject({
      email: 'test@example.com',
      source: 'track_detail',
      experienceId: validUuid,
    });
    expect(mockDb._inserted[0].id).toBeDefined();
    expect(typeof mockDb._inserted[0].id).toBe('string');
    expect(mockDb._inserted[0].createdAt).toBeInstanceOf(Date);
  });
});
