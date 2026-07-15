import type { MiddlewareHandler } from 'hono';
import { createDbClient, type DbClient } from '../db';
import type { Env, Variables } from '../index';

let _dbClient: DbClient | null = null;

export function setDbClient(db: DbClient | null): void {
  _dbClient = db;
}

export function getDbClient(): DbClient | null {
  return _dbClient;
}

export const injectDb = (): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> => {
  return async (c, next) => {
    if (_dbClient) {
      c.set('db', _dbClient);
    } else if (c.env?.DATABASE_URL) {
      _dbClient = createDbClient((c.env.DB_ADAPTER as 'neon') || 'neon', c.env.DATABASE_URL);
      c.set('db', _dbClient);
    }
    await next();
  };
};
