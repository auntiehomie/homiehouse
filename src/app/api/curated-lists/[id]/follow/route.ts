import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { getDb } from '@/lib/db';
import { handleApiError, AuthError } from '@/lib/errors';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { createApiLogger } from '@/lib/logger';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS curated_list_follows (
    id            SERIAL PRIMARY KEY,
    list_id       INTEGER NOT NULL REFERENCES curated_lists(id) ON DELETE CASCADE,
    follower_fid  INTEGER NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(list_id, follower_fid)
  );
`;

async function ensureTable(db: ReturnType<typeof getDb>) {
  await db.query(CREATE_TABLE_SQL);
}

/** POST /api/curated-lists/:id/follow — auth via x-farcaster-fid + x-signer-key headers */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const logger = createApiLogger('/curated-lists/[id]/follow POST');
  logger.start();

  try {

    const verifiedFid = await verifyFarcasterSignerAuth(request);

    // Rate limit: 30 requests/minute per IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`curated-lists-id-follow:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    const { id } = await params;
    const listId = Number(id);

    if (!listId || isNaN(listId)) {
      return NextResponse.json({ error: 'Valid list id is required' }, { status: 400 });
    }

    const db = getDb();
    await ensureTable(db);

    // Only public lists can be followed.
    const { rows: listRows } = await db.query(
      `SELECT is_public, fid AS owner_fid FROM curated_lists WHERE id = $1`,
      [listId]
    );
    if (listRows.length === 0) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }
    if (!listRows[0].is_public) {
      return NextResponse.json({ error: 'This list is not public' }, { status: 403 });
    }
    if (listRows[0].owner_fid === verifiedFid) {
      return NextResponse.json({ error: "You can't follow your own list" }, { status: 400 });
    }

    await db.query(
      `INSERT INTO curated_list_follows (list_id, follower_fid) VALUES ($1, $2)
       ON CONFLICT (list_id, follower_fid) DO NOTHING`,
      [listId, verifiedFid]
    );

    logger.success('List followed', { listId, fid: verifiedFid });
    logger.end();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Failed to follow list', error);
    return handleApiError(error, 'POST /curated-lists/[id]/follow');
  }
}

/** DELETE /api/curated-lists/:id/follow — auth via x-farcaster-fid + x-signer-key headers */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const logger = createApiLogger('/curated-lists/[id]/follow DELETE');
  logger.start();

  try {
    const verifiedFid = await verifyFarcasterSignerAuth(request);
    const { id } = await params;
    const listId = Number(id);

    if (!listId || isNaN(listId)) {
      return NextResponse.json({ error: 'Valid list id is required' }, { status: 400 });
    }

    const db = getDb();
    await ensureTable(db);
    await db.query(`DELETE FROM curated_list_follows WHERE list_id = $1 AND follower_fid = $2`, [listId, verifiedFid]);

    logger.success('List unfollowed', { listId, fid: verifiedFid });
    logger.end();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Failed to unfollow list', error);
    return handleApiError(error, 'DELETE /curated-lists/[id]/follow');
  }
}
