import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hypersnapFetch } from '@/lib/hypersnap';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type FeedCursor = {
  timestamp: string;
  id: number;
};

type FeedRow = {
  id: number;
  list_id: number;
  list_name: string;
  curator_fid: number;
  cast_hash: string;
  cast_text: string | null;
  cast_author_fid: number | null;
  cast_timestamp: string | null;
  added_by_fid: number;
  notes: string | null;
  created_at: string;
  feed_timestamp: string;
};

type CuratorProfile = {
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
};

function decodeCursor(value: string | null): FeedCursor | null {
  if (!value) return null;

  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<FeedCursor>;
    const timestamp = typeof decoded.timestamp === 'string' ? decoded.timestamp : '';
    const id = Number(decoded.id);

    if (!timestamp || Number.isNaN(Date.parse(timestamp)) || !Number.isInteger(id) || id <= 0) {
      return null;
    }

    return { timestamp, id };
  } catch {
    return null;
  }
}

function encodeCursor(timestamp: string | Date, id: number): string {
  return Buffer.from(
    JSON.stringify({ timestamp: new Date(timestamp).toISOString(), id }),
    'utf8',
  ).toString('base64url');
}

/**
 * GET /api/curated-lists/feed?fid=X&limit=20&cursor=...
 *
 * Returns one chronological feed containing items from every public curated
 * list followed by the requested fid. The cursor includes both the effective
 * timestamp and row id so casts sharing a timestamp are never skipped.
 */
export async function GET(request: NextRequest) {
  const logger = createApiLogger('/curated-lists/feed');
  logger.start();

  try {
    const { searchParams } = new URL(request.url);
    const fid = Number(searchParams.get('fid'));
    const requestedLimit = Number(searchParams.get('limit') || DEFAULT_LIMIT);
    const cursorValue = searchParams.get('cursor');
    const cursor = decodeCursor(cursorValue);

    if (!Number.isInteger(fid) || fid <= 0) {
      return NextResponse.json({ error: 'A valid fid is required' }, { status: 400 });
    }

    if (!Number.isInteger(requestedLimit) || requestedLimit <= 0) {
      return NextResponse.json({ error: 'limit must be a positive integer' }, { status: 400 });
    }

    if (cursorValue && !cursor) {
      return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
    }

    const limit = Math.min(requestedLimit, MAX_LIMIT);
    const db = getDb();

    await db.query(`
      CREATE TABLE IF NOT EXISTS curated_list_follows (
        id            SERIAL PRIMARY KEY,
        list_id       INTEGER NOT NULL REFERENCES curated_lists(id) ON DELETE CASCADE,
        follower_fid  INTEGER NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(list_id, follower_fid)
      );
    `);

    const { rows } = await db.query<FeedRow>(
      `SELECT
          cli.id,
          cli.list_id,
          cli.cast_hash,
          cli.cast_text,
          cli.cast_author_fid,
          cli.cast_timestamp,
          cli.added_by_fid,
          cli.notes,
          cli.created_at,
          cl.list_name,
          cl.fid AS curator_fid,
          COALESCE(cli.cast_timestamp, cli.created_at) AS feed_timestamp
       FROM curated_list_follows clf
       JOIN curated_lists cl ON cl.id = clf.list_id AND cl.is_public = true
       JOIN curated_list_items cli ON cli.list_id = cl.id
       WHERE clf.follower_fid = $1
         AND (
           $2::timestamptz IS NULL
           OR COALESCE(cli.cast_timestamp, cli.created_at) < $2::timestamptz
           OR (
             COALESCE(cli.cast_timestamp, cli.created_at) = $2::timestamptz
             AND cli.id < $3
           )
         )
       ORDER BY COALESCE(cli.cast_timestamp, cli.created_at) DESC, cli.id DESC
       LIMIT $4`,
      [fid, cursor?.timestamp ?? null, cursor?.id ?? null, limit + 1],
    );

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const curatorFids = [...new Set(pageRows.map((row) => Number(row.curator_fid)))];
    const curators = new Map<number, CuratorProfile>();

    if (curatorFids.length > 0) {
      try {
        const data = await hypersnapFetch(`/v2/farcaster/user/bulk?fids=${curatorFids.join(',')}`);
        for (const user of data?.users ?? []) {
          if (user?.fid) {
            curators.set(Number(user.fid), {
              fid: Number(user.fid),
              username: user.username,
              display_name: user.display_name,
              pfp_url: user.pfp_url,
            });
          }
        }
      } catch {
        // Curator hydration is best-effort; feed content remains usable by fid.
      }
    }

    const items = pageRows.map((row) => ({
      id: row.id,
      list_id: row.list_id,
      list_name: row.list_name,
      curator_fid: row.curator_fid,
      curator: curators.get(Number(row.curator_fid)) ?? { fid: Number(row.curator_fid) },
      cast_hash: row.cast_hash,
      cast_text: row.cast_text,
      cast_author_fid: row.cast_author_fid,
      cast_timestamp: row.cast_timestamp,
      added_by_fid: row.added_by_fid,
      notes: row.notes,
      created_at: row.created_at,
      feed_timestamp: row.feed_timestamp,
    }));

    const lastItem = items.at(-1);
    const nextCursor = hasMore && lastItem
      ? encodeCursor(lastItem.feed_timestamp, lastItem.id)
      : null;

    logger.success('Unified followed-list feed fetched', {
      fid,
      count: items.length,
      hasMore,
    });
    logger.end();

    return NextResponse.json({ items, nextCursor });
  } catch (error: unknown) {
    logger.error('Failed to fetch unified followed-list feed', error);
    return handleApiError(error, 'GET /curated-lists/feed');
  }
}
