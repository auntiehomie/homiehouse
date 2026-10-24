import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { sql } from '@/lib/db';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const authenticatedFid = await verifyFarcasterSignerAuth(req, 'read:all');
    const castId = req.nextUrl.searchParams.get('cast_id');
    if (!castId) return NextResponse.json({ error: 'cast_id required' }, { status: 400 });

    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success } = rateLimit(`cast-notes:${ip}`, 30, 60);
    if (!success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    const notes = await sql`
      SELECT cn.*
      FROM cast_notes cn
      JOIN users u ON u.id = cn.user_id
      JOIN saved_casts sc ON sc.id = cn.cast_id AND sc.user_id = cn.user_id
      WHERE sc.id = ${castId} AND u.fid = ${authenticatedFid}
      ORDER BY cn.created_at ASC
    `;
    return NextResponse.json({ notes }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authenticatedFid = await verifyFarcasterSignerAuth(req, 'write:casts');
    const body = await req.json().catch(() => null);
    if (!body || (body.fid !== undefined && String(body.fid) !== String(authenticatedFid))) {
      return NextResponse.json({ error: 'Authenticated FID does not match request' }, { status: 403 });
    }
    const { cast_id: castId, note } = body;
    if (typeof castId !== 'string' || !castId || typeof note !== 'string' || !note.trim() || note.length > 10_000) {
      return NextResponse.json({ error: 'Valid cast_id and note are required' }, { status: 400 });
    }

    const [user] = await sql`SELECT id FROM users WHERE fid = ${authenticatedFid}`;
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const [ownedCast] = await sql`SELECT id FROM saved_casts WHERE id = ${castId} AND user_id = ${user.id}`;
    if (!ownedCast) return NextResponse.json({ error: 'Saved cast not found' }, { status: 404 });

    const [existing] = await sql`
      SELECT id FROM cast_notes WHERE user_id = ${user.id} AND cast_id = ${castId} LIMIT 1
    `;
    const [created] = existing
      ? await sql`
          UPDATE cast_notes SET note = ${note.trim()}, updated_at = NOW()
          WHERE id = ${existing.id} AND user_id = ${user.id} AND cast_id = ${castId}
          RETURNING *
        `
      : await sql`
          INSERT INTO cast_notes (user_id, cast_id, note)
          VALUES (${user.id}, ${castId}, ${note.trim()})
          RETURNING *
        `;
    return NextResponse.json({ note: created });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
