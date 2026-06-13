import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { injectDb, setDbClient, getDbClient } from '../db-injector';
import { Hono } from 'hono';
import * as db from '../../db';

vi.mock('../../db', () => ({
  createDbClient: vi.fn(),
}));

describe('db-injector middleware', () => {
  beforeEach(() => {
    setDbClient(null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    setDbClient(null);
  });

  it('manages database client state via getter and setter', () => {
    const mockClient = { insert: vi.fn() } as unknown as db.DbClient;
    setDbClient(mockClient);
    expect(getDbClient()).toBe(mockClient);
  });

  it('injects existing database client to Hono context', async () => {
    const mockClient = { insert: vi.fn() } as unknown as db.DbClient;
    setDbClient(mockClient);

    const app = new Hono<{ Variables: { db: db.DbClient } }>();
    app.use('*', injectDb() as any);
    app.get('/', (c) => {
      const dbInstance = c.get('db');
      return c.json({ hasDb: !!dbInstance, equalsMock: dbInstance === mockClient });
    });

    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ hasDb: true, equalsMock: true });
    expect(db.createDbClient).not.toHaveBeenCalled();
  });

  it('initializes new database client when DATABASE_URL is in env', async () => {
    const mockClient = { insert: vi.fn() } as unknown as db.DbClient;
    vi.mocked(db.createDbClient).mockReturnValue(mockClient as any);

    const app = new Hono<{
      Bindings: { DATABASE_URL: string; DB_ADAPTER?: string };
      Variables: { db: db.DbClient };
    }>();
    app.use('*', injectDb() as any);
    app.get('/', (c) => {
      const dbInstance = c.get('db');
      return c.json({ hasDb: !!dbInstance, equalsMock: dbInstance === mockClient });
    });

    const res = await app.fetch(new Request('http://localhost/'), {
      DATABASE_URL: 'postgres://localhost/test',
      DB_ADAPTER: 'neon',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ hasDb: true, equalsMock: true });
    expect(db.createDbClient).toHaveBeenCalledWith('neon', 'postgres://localhost/test');
    expect(getDbClient()).toBe(mockClient);
  });

  it('does nothing if no client exists and DATABASE_URL is missing', async () => {
    const app = new Hono<{ Variables: { db: db.DbClient } }>();
    app.use('*', injectDb() as any);
    app.get('/', (c) => {
      const dbInstance = c.get('db');
      return c.json({ hasDb: !!dbInstance });
    });

    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ hasDb: false });
    expect(db.createDbClient).not.toHaveBeenCalled();
  });
});
