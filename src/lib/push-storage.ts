import type { Pool } from 'pg';
/** Idempotent bootstrap shared by subscription writes and the first cron run. */
export async function ensurePushTable(db: Pool) {
  await db.query(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_fid INTEGER NOT NULL,
    subscription JSONB NOT NULL,
    last_notified_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  // PostgreSQL expression uniqueness belongs in an index, not a table constraint.
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscription_endpoint
    ON push_subscriptions (user_fid, (subscription->>'endpoint'))`);
  await db.query(`ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS
    preferences JSONB NOT NULL DEFAULT '{"replies":true,"mentions":true,"newCasts":false}'::jsonb`);
  await db.query(`ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS
    last_cast_notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  await db.query(`ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS processing_until TIMESTAMPTZ`);
}

