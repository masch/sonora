import { type Pool } from 'pg';
import { drizzle as neonDrizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as pgDrizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

export type DbClient = NeonHttpDatabase<typeof schema> | NodePgDatabase<typeof schema>;

export function createDbClient(adapter: 'pg', pool: Pool): NodePgDatabase<typeof schema>;
export function createDbClient(
  adapter: 'neon',
  connectionString: string,
): NeonHttpDatabase<typeof schema>;
export function createDbClient(adapter: 'pg' | 'neon', poolOrConnection: Pool | string): DbClient {
  if (adapter === 'pg') {
    return pgDrizzle(poolOrConnection as Pool, { schema }) as NodePgDatabase<typeof schema>;
  }
  const sql = neon(poolOrConnection as string);
  return neonDrizzle(sql, { schema }) as NeonHttpDatabase<typeof schema>;
}
