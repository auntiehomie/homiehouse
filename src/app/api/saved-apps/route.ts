import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { createApiLogger } from '@/lib/logger';
import { rateLimit } from '@/lib/ratelimit';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';

const logger = createApiLogger('/saved-apps');

function matchesFid(value: unknown, authenticatedFid: number): boolean {
  return value === undefined || value === null || String(value) === String(authenticatedFid);
}

export async function GET(req: NextRequest) {
  try {
    const authenticatedFid = await verifyFarcasterSignerAuth(req, 'read:all');
    const requestedFid = req.nextUrl.searchParams.get('fid');
    if (requestedFid && (!/^\d+$/.test(requestedFid) || Number(requestedFid) !== authenticatedFid)) {
      return NextResponse.json({ error: 'You can only read your own saved apps' }, { status: 403 });
    }

    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const { success } = rateLimit(`saved-apps:${ip}`, 60, 60);
    if (!success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    const apps = await sql`
      SELECT id, app_id, app_data, saved_at
      FROM saved_mini_apps
      WHERE user_fid = ${authenticatedFid}
      ORDER BY saved_at DESC
    `;
    return NextResponse.json({ apps }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error('GET', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authenticatedFid = await verifyFarcasterSignerAuth(req, 'write:profile');
    const body = await req.json().catch(() => null);
    if (!body || !matchesFid(body.fid, authenticatedFid)) {
      return NextResponse.json({ error: 'Authenticated FID does not match request' }, { status: 403 });
    }
    const { app_id, app_data } = body;
    if (typeof app_id !== 'string' || !app_id.trim() || app_id.length > 500
      || !app_data || typeof app_data !== 'object' || Array.isArray(app_data)
      || JSON.stringify(app_data).length > 64_000) {
      return NextResponse.json({ error: 'Valid app_id and app_data are required' }, { status: 400 });
    }

    const [app] = await sql`
      INSERT INTO saved_mini_apps (user_fid, app_id, app_data)
      VALUES (${authenticatedFid}, ${app_id.trim()}, ${JSON.stringify(app_data)})
      ON CONFLICT (user_fid, app_id) DO UPDATE SET app_data = EXCLUDED.app_data, saved_at = NOW()
      RETURNING id, app_id, app_data, saved_at
    `;
    return NextResponse.json({ saved: true, app });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error('POST', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authenticatedFid = await verifyFarcasterSignerAuth(req, 'write:profile');
    const body = await req.json().catch(() => null);
    if (!body || !matchesFid(body.fid, authenticatedFid)) {
      return NextResponse.json({ error: 'Authenticated FID does not match request' }, { status: 403 });
    }
    if (typeof body.app_id !== 'string' || !body.app_id.trim() || body.app_id.length > 500) {
      return NextResponse.json({ error: 'Valid app_id is required' }, { status: 400 });
    }

    await sql`DELETE FROM saved_mini_apps WHERE user_fid = ${authenticatedFid} AND app_id = ${body.app_id.trim()}`;
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error('DELETE', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
