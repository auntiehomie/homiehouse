import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Reusable helper — any API route can call this to gate Pro features
export async function isProUser(userFid: number): Promise<boolean> {
  try {
    const rows = await sql`
      SELECT id FROM pro_subscribers
      WHERE user_fid = ${userFid}
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}

// GET /api/pro-status?fid=123 — check if a user has Pro status
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userFid = Number(searchParams.get('fid'));

  if (!userFid || isNaN(userFid) || userFid <= 0) {
    return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
  }

  try {
    const rows = await sql`
      SELECT id, status, subscribed_at, expires_at
      FROM pro_subscribers
      WHERE user_fid = ${userFid}
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `;

    const isPro = rows.length > 0;
    const sub = rows[0] ?? null;

    return NextResponse.json({
      ok: true,
      is_pro: isPro,
      subscription: sub
        ? {
            status: (sub as any).status,
            subscribed_at: (sub as any).subscribed_at,
            expires_at: (sub as any).expires_at,
          }
        : null,
    });
  } catch (err: any) {
    console.error('[pro-status] GET error:', err?.message);
    return NextResponse.json({ ok: false, error: 'Failed to check Pro status' }, { status: 500 });
  }
}