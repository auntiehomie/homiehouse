import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { Pool } from 'pg';

/**
 * Resolve the Postgres connection string.
 *
 * Prefers DATABASE_URL, then falls back to POSTGRES_URL — the variable Vercel's
 * native Neon/Postgres integration injects. This lets the app run whether the
 * database is a standalone Neon project (DATABASE_URL) or one provisioned through
 * Vercel (POSTGRES_URL) with no code change at migration time.
 *
 * Both should point at Neon's POOLED endpoint (host contains "-pooler") for
 * serverless use — avoid the unpooled/direct URL here.
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error('DATABASE_URL (or POSTGRES_URL) environment variable is not set');
  }
  return url;
}

// Neon serverless SQL client (tagged template literal API)
// Use this for new code: await sql`SELECT ...`
// Lazy-initialized so module import doesn't throw at build time.
let _sql: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    _sql = neon(getDatabaseUrl());
  }
  return _sql;
}

// Lazy sql tag — the Proxy target must be a *function* (not {}) so the apply
// trap fires in production minified bundles. Proxying a plain object breaks
// because JS only grants [[Call]] to Proxies whose targets are callable.
export const sql: NeonQueryFunction<false, false> = new Proxy(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ((..._args: unknown[]) => {}) as unknown as NeonQueryFunction<false, false>,
  {
    apply(_target, _thisArg, args) {
      return (getSql() as any)(...args);
    },
    get(_target, prop) {
      return (getSql() as any)[prop];
    },
  }
);

// Legacy pg Pool for existing API routes that use getDb().query(...)
let pool: Pool | null = null;

export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pool;
}
