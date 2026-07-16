import { Pool } from 'pg';
import { drizzle as neonDrizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as pgDrizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

export type DbClient = NeonHttpDatabase<typeof schema> | NodePgDatabase<typeof schema>;

let globalPool: Pool | null = null;

/**
 * Factory function to create a Drizzle database client.
 *
 * Supports two adapters:
 * - 'pg': Standard PostgreSQL connection for local development.
 * - 'neon': Serverless PostgreSQL HTTP client for Staging/Production database.
 *
 * For the 'pg' adapter, `poolOrConnection` supports two formats:
 * 1. `Pool` instance: Used by `server.local.ts` (native Bun/Node server) to reuse a single managed pool.
 * 2. `string` connection string: Used by Hono's `injectDb` middleware in Wrangler dev/worker environments.
 *    To prevent connection leaks inside short-lived Worker requests, a single static pool is instantiated
 *    and cached globally in the module scope.
 */
export function createDbClient(adapter: 'pg', pool: Pool | string): NodePgDatabase<typeof schema>;
export function createDbClient(
  adapter: 'neon',
  connectionString: string,
): NeonHttpDatabase<typeof schema>;
export function createDbClient(adapter: 'pg' | 'neon', poolOrConnection: Pool | string): DbClient {
  if (adapter === 'pg') {
    let pool: Pool;
    if (typeof poolOrConnection === 'string') {
      if (!globalPool) {
        globalPool = new Pool({ connectionString: poolOrConnection, max: 10 });
      }
      pool = globalPool;
    } else {
      pool = poolOrConnection;
    }
    return pgDrizzle(pool, { schema }) as NodePgDatabase<typeof schema>;
  }
  const sql = neon(poolOrConnection as string);
  return neonDrizzle(sql, { schema }) as NeonHttpDatabase<typeof schema>;
}
