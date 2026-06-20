import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// GET /api/saved-casts?fid=123
export async function GET(req: NextRequest) {
  const fid = req.nextUrl.searchParams.get('fid');
  if (!fid) return NextResponse.json({ error: 'fid required' }, { status: 400 });

  try {
    const rows = await sql`
      SELECT sc.*, cn.note, cn.id as note_id
      FROM saved_casts sc
      JOIN users u ON u.id = sc.user_id
      LEFT JOIN cast_notes cn ON cn.cast_id = sc.id
      WHERE u.fid = ${parseInt(fid)}
      ORDER BY sc.saved_at DESC
    `;
    return NextResponse.json({ casts: rows });
  } catch (err) {
    console.error('saved-casts GET error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/saved-casts
// body: { fid, cast_hash, cast_author_fid, cast_author_username, cast_text, cast_timestamp, embeds, raw_cast }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { fid, cast_hash, cast_author_fid, cast_author_username, cast_text, cast_timestamp, embeds, raw_cast } = body;
  if (!fid || !cast_hash) return NextResponse.json({ error: 'fid and cast_hash required' }, { status: 400 });

  try {
    // Upsert user
    await sql`
      INSERT INTO users (fid) VALUES (${fid})
      ON CONFLICT (fid) DO NOTHING
    `;
    const [user] = await sql`SELECT id FROM users WHERE fid = ${fid}`;

    // Insert saved cast
    const [saved] = await sql`
      INSERT INTO saved_casts (user_id, cast_hash, cast_author_fid, cast_author_username, cast_text, cast_timestamp, embeds, raw_cast)
      VALUES (${user.id}, ${cast_hash}, ${cast_author_fid}, ${cast_author_username}, ${cast_text}, ${cast_timestamp}, ${JSON.stringify(embeds || [])}, ${JSON.stringify(raw_cast || {})})
      ON CONFLICT (user_id, cast_hash) DO NOTHING
      RETURNING id
    `;
    return NextResponse.json({ saved: true, id: saved?.id });
  } catch (err) {
    console.error('saved-casts POST error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
