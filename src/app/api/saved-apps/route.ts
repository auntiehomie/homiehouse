import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// GET /api/saved-apps?fid=123
export async function GET(req: NextRequest) {
  const fid = req.nextUrl.searchParams.get('fid');
  if (!fid || !/^\d+$/.test(fid)) return NextResponse.json({ error: 'fid required' }, { status: 400 });
  try {
    const apps = await sql`
      SELECT id, app_id, app_data, saved_at
      FROM saved_mini_apps
      WHERE user_fid = ${Number(fid)}
      ORDER BY saved_at DESC
    `;
    return NextResponse.json({ apps });
  } catch (error) {
    console.error('saved-apps GET error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/saved-apps { fid, app_id, app_data }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { fid, app_id, app_data } = body;
  if (!Number.isInteger(Number(fid)) || Number(fid) <= 0 || !app_id || typeof app_data !== 'object') {
    return NextResponse.json({ error: 'fid, app_id, and app_data required' }, { status: 400 });
  }
  try {
    const [app] = await sql`
      INSERT INTO saved_mini_apps (user_fid, app_id, app_data)
      VALUES (${Number(fid)}, ${String(app_id)}, ${JSON.stringify(app_data)})
      ON CONFLICT (user_fid, app_id) DO UPDATE SET app_data = EXCLUDED.app_data, saved_at = NOW()
      RETURNING id, app_id, app_data, saved_at
    `;
    return NextResponse.json({ saved: true, app });
  } catch (error) {
    console.error('saved-apps POST error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// DELETE /api/saved-apps { fid, app_id }
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { fid, app_id } = body;
  if (!Number.isInteger(Number(fid)) || Number(fid) <= 0 || !app_id) {
    return NextResponse.json({ error: 'fid and app_id required' }, { status: 400 });
  }
  try {
    await sql`DELETE FROM saved_mini_apps WHERE user_fid = ${Number(fid)} AND app_id = ${String(app_id)}`;
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('saved-apps DELETE error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
