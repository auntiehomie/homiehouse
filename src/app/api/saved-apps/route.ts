import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/saved-apps?fid=X
export async function GET(req: NextRequest) {
  const fid = req.nextUrl.searchParams.get('fid');
  if (!fid) return NextResponse.json({ apps: [] });
  const db = getDb();
  const rows = await db.query(
    'SELECT app_data FROM saved_mini_apps WHERE user_fid = $1 ORDER BY saved_at DESC',
    [parseInt(fid)]
  );
  return NextResponse.json({ apps: rows.rows.map((r: any) => r.app_data) });
}

// POST /api/saved-apps  body: { fid, app }
export async function POST(req: NextRequest) {
  const { fid, app } = await req.json();
  if (!fid || !app?.id) return NextResponse.json({ error: 'Missing fid or app' }, { status: 400 });
  const db = getDb();
  await db.query(
    `INSERT INTO saved_mini_apps (user_fid, app_id, app_data)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_fid, app_id) DO UPDATE SET app_data = $3, saved_at = NOW()`,
    [parseInt(fid), app.id, JSON.stringify(app)]
  );
  return NextResponse.json({ ok: true });
}

// DELETE /api/saved-apps  body: { fid, appId }
export async function DELETE(req: NextRequest) {
  const { fid, appId } = await req.json();
  if (!fid || !appId) return NextResponse.json({ error: 'Missing fid or appId' }, { status: 400 });
  const db = getDb();
  await db.query(
    'DELETE FROM saved_mini_apps WHERE user_fid = $1 AND app_id = $2',
    [parseInt(fid), appId]
  );
  return NextResponse.json({ ok: true });
}
