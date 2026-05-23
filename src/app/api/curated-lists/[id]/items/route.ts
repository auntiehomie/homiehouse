import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;

    const { rows } = await db.query(
      `SELECT * FROM curated_list_items WHERE list_id = $1 ORDER BY created_at DESC`,
      [parseInt(id)]
    );

    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error('Exception in GET /api/curated-lists/[id]/items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await request.json();
    const { castHash, addedByFid, castData, notes } = body;

    if (!castHash || !addedByFid) {
      return NextResponse.json({ error: 'castHash and addedByFid are required' }, { status: 400 });
    }

    try {
      const { rows } = await db.query(
        `INSERT INTO curated_list_items
          (list_id, cast_hash, cast_author_fid, cast_text, cast_timestamp, added_by_fid, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          parseInt(id),
          castHash,
          castData?.author_fid || null,
          castData?.text || null,
          castData?.timestamp || null,
          parseInt(addedByFid),
          notes || null,
        ]
      );
      return NextResponse.json({ item: rows[0] });
    } catch (err: any) {
      if (err.code === '23505') {
        return NextResponse.json({ error: 'Cast already in this list' }, { status: 400 });
      }
      console.error('Error adding cast to list:', err);
      return NextResponse.json({ error: 'Failed to add cast to list' }, { status: 500 });
    }
  } catch (error) {
    console.error('Exception in POST /api/curated-lists/[id]/items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const castHash = searchParams.get('castHash');

    if (!castHash) {
      return NextResponse.json({ error: 'castHash is required' }, { status: 400 });
    }

    await db.query(
      `DELETE FROM curated_list_items WHERE list_id = $1 AND cast_hash = $2`,
      [parseInt(id), castHash]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Exception in DELETE /api/curated-lists/[id]/items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
