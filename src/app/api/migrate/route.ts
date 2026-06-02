import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

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

CREATE INDEX IF NOT EXISTS idx_saved_casts_user_id ON saved_casts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_casts_cast_hash ON saved_casts(cast_hash);
CREATE INDEX IF NOT EXISTS idx_cast_notes_cast_id ON cast_notes(cast_id);
CREATE INDEX IF NOT EXISTS idx_cast_notes_user_id ON cast_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_mini_apps_fid ON saved_mini_apps(user_fid);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_fid ON push_subscriptions(user_fid);
`;

export async function POST(request: Request) {
  const secret = process.env.MIGRATE_SECRET;

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
    // Run each statement individually (neon tagged-template doesn't support multi-statement strings)
    const statements = SCHEMA
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      await sql.query(stmt);
    }

    return NextResponse.json({
      ok: true,
      message: 'Schema applied successfully',
      tables: ['users', 'saved_casts', 'cast_notes', 'saved_mini_apps', 'push_subscriptions'],
    });
  } catch (err: any) {
    console.error('[migrate] error:', err);
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
