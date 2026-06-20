import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

async function ensureTable(db: ReturnType<typeof getDb>) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_fid INTEGER NOT NULL,
      subscription JSONB NOT NULL,
      last_notified_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_fid, (subscription->>'endpoint'))
    )
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_push_subscriptions_fid ON push_subscriptions(user_fid)`
  );
}

// POST /api/push/subscribe  { fid, subscription }
export async function POST(req: NextRequest) {
  try {
    const { fid, subscription } = await req.json();
    if (!fid || !subscription?.endpoint) {
      return NextResponse.json({ error: 'fid and subscription required' }, { status: 400 });
    }

    const db = getDb();
    await ensureTable(db);

    await db.query(
      `INSERT INTO push_subscriptions (user_fid, subscription)
       VALUES ($1, $2)
       ON CONFLICT (user_fid, (subscription->>'endpoint')) DO UPDATE
         SET subscription = EXCLUDED.subscription,
             last_notified_at = NOW()`,
      [fid, JSON.stringify(subscription)]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[push/subscribe] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/push/subscribe  { fid, endpoint }
export async function DELETE(req: NextRequest) {
  try {
    const { fid, endpoint } = await req.json();
    if (!fid || !endpoint) {
      return NextResponse.json({ error: 'fid and endpoint required' }, { status: 400 });
    }

    const db = getDb();
    await db.query(
      `DELETE FROM push_subscriptions
       WHERE user_fid = $1 AND subscription->>'endpoint' = $2`,
      [fid, endpoint]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[push/subscribe] DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
