import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { fid, subscription } = await req.json();
  if (!fid || !subscription?.endpoint) {
    return NextResponse.json({ error: 'Missing fid or subscription' }, { status: 400 });
  }
  const db = getDb();
  await db.query(
    `INSERT INTO push_subscriptions (user_fid, subscription)
     VALUES ($1, $2)
     ON CONFLICT (user_fid, (subscription->>'endpoint')) DO NOTHING`,
    [parseInt(fid), JSON.stringify(subscription)]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { fid, endpoint } = await req.json();
  if (!fid) return NextResponse.json({ error: 'Missing fid' }, { status: 400 });
  const db = getDb();
  if (endpoint) {
    await db.query(
      `DELETE FROM push_subscriptions WHERE user_fid = $1 AND subscription->>'endpoint' = $2`,
      [parseInt(fid), endpoint]
    );
  } else {
    await db.query('DELETE FROM push_subscriptions WHERE user_fid = $1', [parseInt(fid)]);
  }
  return NextResponse.json({ ok: true });
}
