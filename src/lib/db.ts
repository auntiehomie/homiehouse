import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { Pool } from 'pg';

// Neon serverless SQL client (tagged template literal API)
// Use this for new code: await sql`SELECT ...`
// Lazy-initialized so module import doesn't throw at build time.
let _sql: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

// Convenience proxy so you can still write: sql`SELECT ...`
export const sql: NeonQueryFunction<false, false> = new Proxy({} as NeonQueryFunction<false, false>, {
  apply(_target, _thisArg, args) {
    return (getSql() as any)(...args);
  },
  get(_target, prop) {
    return (getSql() as any)[prop];
  },
});

// Legacy pg Pool for existing API routes that use getDb().query(...)
let pool: Pool | null = null;

export function getDb(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pool;
}
