import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// GET /api/cast-notes?cast_id=uuid
export async function GET(req: NextRequest) {
  const cast_id = req.nextUrl.searchParams.get('cast_id');
  if (!cast_id) return NextResponse.json({ error: 'cast_id required' }, { status: 400 });

  try {
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

    const [created] = await sql`
      INSERT INTO cast_notes (user_id, cast_id, note)
      VALUES (${user.id}, ${cast_id}, ${note})
      RETURNING *
    `;
    return NextResponse.json({ note: created });
  } catch (err) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
