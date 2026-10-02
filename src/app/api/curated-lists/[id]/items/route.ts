import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { getDb } from '@/lib/db';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {

    // Rate limit: 30 requests/minute per IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`curated-lists-id-items:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
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
    const verifiedFid = await verifyFarcasterSignerAuth(request);
    const db = getDb();
    const { id } = await params;
    const body = await request.json();
    const { castHash, castData, notes } = body;

    if (!castHash) {
      return NextResponse.json({ error: 'castHash is required' }, { status: 400 });
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
          verifiedFid,
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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Exception in POST /api/curated-lists/[id]/items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const verifiedFid = await verifyFarcasterSignerAuth(request);
    const db = getDb();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const castHash = searchParams.get('castHash');

    if (!castHash) {
      return NextResponse.json({ error: 'castHash is required' }, { status: 400 });
    }

    // Verify the requesting user owns this list before allowing item deletion
    const listCheck = await db.query(
      `SELECT fid FROM curated_lists WHERE id = $1`,
      [parseInt(id)]
    );
    if (listCheck.rows.length === 0) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }
    if (listCheck.rows[0].fid !== verifiedFid) {
      return NextResponse.json({ error: 'Not authorized to modify this list' }, { status: 403 });
    }

    await db.query(
      `DELETE FROM curated_list_items WHERE list_id = $1 AND cast_hash = $2`,
      [parseInt(id), castHash]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Exception in DELETE /api/curated-lists/[id]/items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
