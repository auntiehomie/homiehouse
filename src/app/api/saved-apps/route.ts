import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

function validFid(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

// GET /api/saved-apps?fid=X
export async function GET(req: NextRequest) {
  const rawFid = req.nextUrl.searchParams.get('fid');
  const fid = rawFid ? Number(rawFid) : NaN;
  if (!validFid(fid)) return NextResponse.json({ apps: [] });
  try {
    const db = getDb();
    const rows = await db.query(
      'SELECT app_data FROM saved_mini_apps WHERE user_fid = $1 ORDER BY saved_at DESC',
      [fid]
    );
    return NextResponse.json({ apps: rows.rows.map((r: any) => r.app_data) });
  } catch (error) {
    console.error('saved-apps GET failed', error);
    return NextResponse.json({ error: 'Unable to load saved apps' }, { status: 500 });
  }
}

// POST /api/saved-apps  body: { fid, app }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fid = Number(body?.fid);
    const app = body?.app;
    if (!validFid(fid) || !app?.id || typeof app.id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid fid or app' }, { status: 400 });
    }
    const db = getDb();
    await db.query(
      `INSERT INTO saved_mini_apps (user_fid, app_id, app_data)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_fid, app_id) DO UPDATE SET app_data = $3, saved_at = NOW()`,
      [fid, app.id, JSON.stringify(app)]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('saved-apps POST failed', error);
    return NextResponse.json({ error: 'Unable to save app' }, { status: 500 });
  }
}

// DELETE /api/saved-apps  body: { fid, appId }
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const fid = Number(body?.fid);
    const appId = body?.appId;
    if (!validFid(fid) || !appId || typeof appId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid fid or appId' }, { status: 400 });
    }
    const db = getDb();
    await db.query(
      'DELETE FROM saved_mini_apps WHERE user_fid = $1 AND app_id = $2',
      [fid, appId]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('saved-apps DELETE failed', error);
    return NextResponse.json({ error: 'Unable to delete saved app' }, { status: 500 });
  }
}
