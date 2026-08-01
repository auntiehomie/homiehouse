import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { sql } from '@/lib/db';

// GET /api/cast-notes?cast_id=uuid
export async function GET(req: NextRequest) {
  const cast_id = req.nextUrl.searchParams.get('cast_id');
  if (!cast_id) return NextResponse.json({ error: 'cast_id required' }, { status: 400 });

  try {

    // Rate limit: 30 requests/minute per IP
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`cast-notes:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    const notes = await sql`SELECT * FROM cast_notes WHERE cast_id = ${cast_id} ORDER BY created_at ASC`;
    return NextResponse.json({ notes });
  } catch (err) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/cast-notes
// body: { cast_id, fid, note }
export async function POST(req: NextRequest) {
  const { cast_id, fid, note } = await req.json();
  if (!cast_id || !fid || !note) return NextResponse.json({ error: 'cast_id, fid, and note required' }, { status: 400 });

  try {
    const [user] = await sql`SELECT id FROM users WHERE fid = ${fid}`;
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Upsert: update existing note if one exists for this user+cast
    const [existing] = await sql`
      SELECT id FROM cast_notes WHERE user_id = ${user.id} AND cast_id = ${cast_id}
    `;
    let created;
    if (existing) {
      [created] = await sql`
        UPDATE cast_notes SET note = ${note}, updated_at = NOW()
        WHERE id = ${existing.id}
        RETURNING *
      `;
    } else {
      [created] = await sql`
        INSERT INTO cast_notes (user_id, cast_id, note)
        VALUES (${user.id}, ${cast_id}, ${note})
        RETURNING *
      `;
    }
    return NextResponse.json({ note: created });
  } catch (err) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
