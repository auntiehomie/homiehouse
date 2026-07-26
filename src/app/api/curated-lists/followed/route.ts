import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hypersnapFetch } from '@/lib/hypersnap';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';

/** GET /api/curated-lists/followed?fid=X — public lists this fid follows. */
export async function GET(request: NextRequest) {
  const logger = createApiLogger('/curated-lists/followed');
  logger.start();

  try {
    const { searchParams } = new URL(request.url);
    const fid = Number(searchParams.get('fid'));
    if (!fid || isNaN(fid)) {
      return NextResponse.json({ error: 'fid is required' }, { status: 400 });
    }

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

    const { rows } = await db.query(
      `SELECT cl.*, COUNT(cli.id)::int AS item_count
       FROM curated_list_follows clf
       JOIN curated_lists cl ON cl.id = clf.list_id
       LEFT JOIN curated_list_items cli ON cli.list_id = cl.id
       WHERE clf.follower_fid = $1
       GROUP BY cl.id
       ORDER BY clf.created_at DESC`,
      [fid]
    );

    const curatorFids = [...new Set(rows.map((r: any) => r.fid))];
    const curators = new Map<number, any>();
    if (curatorFids.length > 0) {
      try {
        const data = await hypersnapFetch(`/v2/farcaster/user/bulk?fids=${curatorFids.join(',')}`);
        for (const u of data?.users ?? []) {
          if (u?.fid) curators.set(u.fid, { fid: u.fid, username: u.username, display_name: u.display_name, pfp_url: u.pfp_url });
        }
      } catch {
        // Best-effort — lists still render with just a fid if hydration fails
      }
    }

    const lists = rows.map((r: any) => ({ ...r, curator: curators.get(r.fid) ?? { fid: r.fid } }));

    logger.success('Followed lists fetched', { count: lists.length });
    logger.end();
    return NextResponse.json({ lists });
  } catch (error: any) {
    logger.error('Failed to fetch followed lists', error);
    return handleApiError(error, 'GET /curated-lists/followed');
  }
}
