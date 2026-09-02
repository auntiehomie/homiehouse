import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { createApiLogger } from '@/lib/logger';

const logger = createApiLogger('/migrate');

// POST /api/migrate
// Protected by MIGRATE_SECRET env var.
// Run once after deploying to initialize the Neon schema.
// curl -X POST https://your-domain.vercel.app/api/migrate \
//   -H "Authorization: Bearer <MIGRATE_SECRET>"

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fid INTEGER UNIQUE NOT NULL,
  username TEXT,
  display_name TEXT,
  pfp_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_casts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cast_hash TEXT NOT NULL,
  cast_author_fid INTEGER,
  cast_author_username TEXT,
  cast_text TEXT,
  cast_timestamp TIMESTAMPTZ,
  embeds JSONB DEFAULT '[]',
  raw_cast JSONB,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, cast_hash)
);

CREATE TABLE IF NOT EXISTS cast_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cast_id UUID NOT NULL REFERENCES saved_casts(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_mini_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_fid INTEGER NOT NULL,
  app_id TEXT NOT NULL,
  app_data JSONB NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_fid, app_id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_fid INTEGER NOT NULL,
  subscription JSONB NOT NULL,
  last_notified_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_fid, (subscription->>'endpoint'))
);

CREATE TABLE IF NOT EXISTS learning_progress (
  fid INTEGER PRIMARY KEY,
  plan JSONB,
  completed_ids JSONB DEFAULT '[]',
  completions JSONB DEFAULT '{}',
  hh2_points INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE learning_progress ADD COLUMN IF NOT EXISTS hh2_points INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS hh2_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fid INTEGER NOT NULL,
  module_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  tx_hash TEXT,
  amount INTEGER DEFAULT 10,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fid, module_id)
);

CREATE INDEX IF NOT EXISTS idx_hh2_claims_fid ON hh2_claims(fid);

CREATE TABLE IF NOT EXISTS scheduled_casts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_fid INTEGER NOT NULL,
  text TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  cast_hash TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_casts_user_fid ON scheduled_casts(user_fid);
CREATE INDEX IF NOT EXISTS idx_scheduled_casts_status ON scheduled_casts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_casts_scheduled_for ON scheduled_casts(scheduled_for);

CREATE TABLE IF NOT EXISTS hh2_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_fid INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_fid, item_id)
);

CREATE INDEX IF NOT EXISTS idx_hh2_purchases_user_fid ON hh2_purchases(user_fid);

CREATE TABLE IF NOT EXISTS pro_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_fid INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_subscribers_user_fid ON pro_subscribers(user_fid);
CREATE INDEX IF NOT EXISTS idx_pro_subscribers_status ON pro_subscribers(status);

CREATE TABLE IF NOT EXISTS sponsored_casts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_fid INTEGER NOT NULL,
  cast_hash TEXT NOT NULL,
  impression_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  budget_remaining INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsored_casts_budget ON sponsored_casts(budget_remaining);

CREATE INDEX IF NOT EXISTS idx_saved_casts_user_id ON saved_casts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_casts_cast_hash ON saved_casts(cast_hash);
CREATE INDEX IF NOT EXISTS idx_cast_notes_cast_id ON cast_notes(cast_id);
CREATE INDEX IF NOT EXISTS idx_cast_notes_user_id ON cast_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_mini_apps_fid ON saved_mini_apps(user_fid);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_fid ON push_subscriptions(user_fid);
`;

export async function POST(request: Request) {
  const secret = 'wu_1tNIHDCI1SX7R';

  if (!secret) {
    return NextResponse.json(
      { error: 'MIGRATE_SECRET not configured on server' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getSql();
    // Run each statement individually, continue on error
    const statements = SCHEMA
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    const results: Array<{ stmt: string; ok: boolean; error?: string }> = [];

    for (const stmt of statements) {
      try {
        await sql.query(stmt);
        results.push({ stmt: stmt.slice(0, 80), ok: true });
      } catch (e: any) {
        // Don't abort — keep going so missing tables get created
        results.push({ stmt: stmt.slice(0, 80), ok: false, error: e?.message });
      }
    }

    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      return NextResponse.json({
        ok: false,
        message: `${failed.length} statements failed (non-fatal — rest succeeded)`,
        results,
      });
    }

    return NextResponse.json({
      ok: true,
      message: 'Schema applied successfully',
      tables: ['users', 'saved_casts', 'cast_notes', 'saved_mini_apps', 'push_subscriptions', 'learning_progress', 'hh2_claims', 'scheduled_casts', 'hh2_purchases', 'pro_subscribers', 'sponsored_casts'],
    });
  } catch (err: any) {
    logger.error('error', err);
    return NextResponse.json(
      { error: err?.message ?? 'Migration failed' },
      { status: 500 }
    );
  }
}

// GET returns instructions — handy for a quick sanity check
export async function GET() {
  return NextResponse.json({
    info: 'POST /api/migrate with Authorization: Bearer <MIGRATE_SECRET> to run schema',
  });
}
