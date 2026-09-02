import { NextRequest, NextResponse } from 'next/server';
import { sql, getSql } from '@/lib/db';
import { getStreak, recordActivity } from '@/lib/learning-streak';

export const maxDuration = 10;

// Auto-create tables on first use — no migration command needed.
const ENSURE_TABLES = `
CREATE TABLE IF NOT EXISTS learning_progress (
  fid INTEGER PRIMARY KEY,
  plan JSONB,
  completed_ids JSONB DEFAULT '[]',
  completions JSONB DEFAULT '{}',
  hh2_points INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS hh2_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fid INTEGER NOT NULL,
  module_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  amount INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fid, module_id)
);
CREATE TABLE IF NOT EXISTS hh2_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_fid INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_fid, item_id)
);
`;

let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  try {
    const s = getSql();
    for (const stmt of ENSURE_TABLES.split(';').map(s => s.trim()).filter(Boolean)) {
      await s.query(stmt);
    }
    tablesReady = true;
  } catch (e) {
    // Best-effort — if it fails, the query itself will throw a clearer error
  }
}

// GET /api/learning-progress?fid=12345
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fid = parseInt(searchParams.get('fid') ?? '', 10);

  if (!fid || isNaN(fid)) {
    return NextResponse.json({ error: 'fid required' }, { status: 400 });
  }

  try {
    await ensureTables();
    const [rows, streak] = await Promise.all([
      sql`
        SELECT plan, completed_ids, completions, hh2_points, updated_at
        FROM learning_progress
        WHERE fid = ${fid}
      `,
      getStreak(fid),
    ]);

    if (rows.length === 0) return NextResponse.json({ found: false, streak });

    const row = rows[0];
    return NextResponse.json({
      found: true,
      plan: row.plan,
      completed_ids: row.completed_ids ?? [],
      completions: row.completions ?? {},
      hh2_points: row.hh2_points ?? 0,
      updated_at: row.updated_at,
      streak,
    });
  } catch (err: any) {
    console.error('[learning-progress] GET error:', err?.message);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/learning-progress
// Body: { fid, plan, completed_ids, completions, hh2_points }
export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const { fid, plan, completed_ids, completions, hh2_points } = await req.json();

    if (!fid) {
      return NextResponse.json({ error: 'fid required' }, { status: 400 });
    }

    const points = typeof hh2_points === 'number' ? hh2_points : 0;

    await sql`
      INSERT INTO learning_progress (fid, plan, completed_ids, completions, hh2_points, updated_at)
      VALUES (
        ${fid},
        ${JSON.stringify(plan ?? null)}::jsonb,
        ${JSON.stringify(completed_ids ?? [])}::jsonb,
        ${JSON.stringify(completions ?? {})}::jsonb,
        ${points},
        NOW()
      )
      ON CONFLICT (fid) DO UPDATE SET
        plan = EXCLUDED.plan,
        completed_ids = EXCLUDED.completed_ids,
        completions = EXCLUDED.completions,
        hh2_points = EXCLUDED.hh2_points,
        updated_at = NOW()
    `;

    // Every save is treated as "showed up today" for streak purposes — see
    // learning-streak.ts for why a separate completion-event stream isn't needed.
    const streak = await recordActivity(fid);

    return NextResponse.json({ success: true, streak });
  } catch (err: any) {
    console.error('[learning-progress] POST error:', err?.message);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
