import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { sql } from '@/lib/db';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';

function matchesFid(value: unknown, authenticatedFid: number): boolean {
  return value === undefined || value === null || String(value) === String(authenticatedFid);
}

export async function GET(req: NextRequest) {
  try {
    const authenticatedFid = await verifyFarcasterSignerAuth(req, 'read:all');
    const requestedFid = req.nextUrl.searchParams.get('fid');
    if (requestedFid && (!/^\d+$/.test(requestedFid) || Number(requestedFid) !== authenticatedFid)) {
      return NextResponse.json({ error: 'You can only read your own saved casts' }, { status: 403 });
    }

    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success } = rateLimit(`saved-casts:${ip}`, 30, 60);
    if (!success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    const rows = await sql`
      SELECT sc.*, cn.note, cn.id as note_id
      FROM saved_casts sc
      JOIN users u ON u.id = sc.user_id
      LEFT JOIN cast_notes cn ON cn.cast_id = sc.id AND cn.user_id = sc.user_id
      WHERE u.fid = ${authenticatedFid}
      ORDER BY sc.saved_at DESC
    `;
    return NextResponse.json({ casts: rows }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('saved-casts GET error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authenticatedFid = await verifyFarcasterSignerAuth(req, 'write:casts');
    const body = await req.json().catch(() => null);
    if (!body || !matchesFid(body.fid, authenticatedFid)) {
      return NextResponse.json({ error: 'Authenticated FID does not match request' }, { status: 403 });
    }
    const { cast_hash, cast_author_fid, cast_author_username, cast_text, cast_timestamp, embeds, raw_cast } = body;
    if (typeof cast_hash !== 'string' || !cast_hash || cast_hash.length > 256
      || (cast_text !== undefined && (typeof cast_text !== 'string' || cast_text.length > 100_000))
      || (embeds !== undefined && !Array.isArray(embeds))) {
      return NextResponse.json({ error: 'Valid cast data is required' }, { status: 400 });
    }

    await sql`INSERT INTO users (fid) VALUES (${authenticatedFid}) ON CONFLICT (fid) DO NOTHING`;
    const [user] = await sql`SELECT id FROM users WHERE fid = ${authenticatedFid}`;
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const [saved] = await sql`
      INSERT INTO saved_casts (user_id, cast_hash, cast_author_fid, cast_author_username, cast_text, cast_timestamp, embeds, raw_cast)
      VALUES (${user.id}, ${cast_hash}, ${cast_author_fid ?? null}, ${cast_author_username ?? null}, ${cast_text ?? null}, ${cast_timestamp ?? null}, ${JSON.stringify(embeds || [])}, ${JSON.stringify(raw_cast || {})})
      ON CONFLICT (user_id, cast_hash) DO NOTHING
      RETURNING id
    `;
    return NextResponse.json({ saved: true, id: saved?.id });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('saved-casts POST error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authenticatedFid = await verifyFarcasterSignerAuth(req, 'write:casts');
    const body = await req.json().catch(() => null);
    if (!body || !matchesFid(body.fid, authenticatedFid)) {
      return NextResponse.json({ error: 'Authenticated FID does not match request' }, { status: 403 });
    }
    if (typeof body.cast_hash !== 'string' || !body.cast_hash || body.cast_hash.length > 256) {
      return NextResponse.json({ error: 'Valid cast_hash is required' }, { status: 400 });
    }
    await sql`
      DELETE FROM saved_casts sc
      USING users u
      WHERE sc.user_id = u.id AND u.fid = ${authenticatedFid} AND sc.cast_hash = ${body.cast_hash}
    `;
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('saved-casts DELETE error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
