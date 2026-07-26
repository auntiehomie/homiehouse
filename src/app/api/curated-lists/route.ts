import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hypersnapFetch } from '@/lib/hypersnap';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';

/** Bulk-hydrate curator fids into { fid, username, display_name, pfp_url } — same
 * /v2/farcaster/user/bulk endpoint already used by /api/profile for single lookups. */
async function hydrateCurators(fids: number[]): Promise<Map<number, any>> {
  const map = new Map<number, any>();
  if (fids.length === 0) return map;
  try {
    const data = await hypersnapFetch(`/v2/farcaster/user/bulk?fids=${fids.join(',')}`);
    for (const u of data?.users ?? []) {
      if (u?.fid) map.set(u.fid, { fid: u.fid, username: u.username, display_name: u.display_name, pfp_url: u.pfp_url });
    }
  } catch {
    // Best-effort — lists still render with just a fid if hydration fails
  }
  return map;
}

export async function GET(request: NextRequest) {
  const logger = createApiLogger('/curated-lists');
  logger.start();

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const isPublicBrowse = searchParams.get('public') === 'true';

    if (isPublicBrowse) {
      logger.info('Browsing public lists');
      const { rows } = await db.query(
        `SELECT cl.*, COUNT(cli.id)::int AS item_count
         FROM curated_lists cl
         LEFT JOIN curated_list_items cli ON cli.list_id = cl.id
         WHERE cl.is_public = true
         GROUP BY cl.id
         ORDER BY cl.created_at DESC
         LIMIT 50`
      );
      const curators = await hydrateCurators([...new Set(rows.map((r: any) => r.fid))]);
      const lists = rows.map((r: any) => ({ ...r, curator: curators.get(r.fid) ?? { fid: r.fid } }));
      logger.success('Public lists fetched', { count: lists.length });
      logger.end();
      return NextResponse.json({ lists });
    }

    if (!fidParam) {
      return NextResponse.json({ error: 'fid is required' }, { status: 400 });
    }

    const fid = Number(fidParam);
    if (!fid || isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid' }, { status: 400 });
    }

    logger.info('Fetching curated lists', { fid });

    const { rows } = await db.query(
      `SELECT * FROM curated_lists WHERE fid = $1 ORDER BY created_at DESC`,
      [fid]
    );

    logger.success('Lists fetched', { count: rows.length });
    logger.end();
    return NextResponse.json({ lists: rows });
  } catch (error: any) {
    logger.error('Failed to fetch curated lists', error);
    return handleApiError(error, 'GET /curated-lists');
  }
}

/**
 * PATCH /api/curated-lists
 * Body: { id, fid, isPublic } — toggle an existing list's visibility.
 * fid must match the list's owner (ownership check in the WHERE clause).
 */
export async function PATCH(request: NextRequest) {
  const logger = createApiLogger('/curated-lists PATCH');
  logger.start();

  try {
    const db = getDb();
    const { id, fid, isPublic } = await request.json();

    const listId = Number(id);
    const ownerFid = Number(fid);
    if (!listId || isNaN(listId) || !ownerFid || isNaN(ownerFid) || typeof isPublic !== 'boolean') {
      return NextResponse.json({ error: 'id, fid, and isPublic (boolean) are required' }, { status: 400 });
    }

    const { rows } = await db.query(
      `UPDATE curated_lists SET is_public = $1, updated_at = NOW() WHERE id = $2 AND fid = $3 RETURNING *`,
      [isPublic, listId, ownerFid]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'List not found or not owned by this fid' }, { status: 404 });
    }

    logger.success('List visibility updated', { listId, isPublic });
    logger.end();
    return NextResponse.json({ list: rows[0] });
  } catch (error: any) {
    logger.error('Failed to update list visibility', error);
    return handleApiError(error, 'PATCH /curated-lists');
  }
}

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/curated-lists POST');
  logger.start();

  try {
    const db = getDb();
    const body = await request.json();
    const { fid, listName, description, isPublic } = body;

    if (!fid || !listName) {
      return NextResponse.json({ error: 'fid and listName are required' }, { status: 400 });
    }

    const validatedFid = Number(fid);
    if (!validatedFid || isNaN(validatedFid)) {
      return NextResponse.json({ error: 'Invalid fid' }, { status: 400 });
    }

    logger.info('Creating list', { fid: validatedFid, listName });

    try {
      const { rows } = await db.query(
        `INSERT INTO curated_lists (fid, list_name, description, is_public)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [validatedFid, listName, description || null, isPublic || false]
      );
      logger.success('List created', { listId: rows[0]?.id });
      logger.end();
      return NextResponse.json({ list: rows[0] });
    } catch (err: any) {
      if (err.code === '23505') {
        return NextResponse.json({ error: 'List with this name already exists' }, { status: 400 });
      }
      logger.error('Database error creating list', err);
      return NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
    }
  } catch (error: any) {
    logger.error('Failed to create list', error);
    return handleApiError(error, 'POST /curated-lists');
  }
}

export async function DELETE(request: NextRequest) {
  const logger = createApiLogger('/curated-lists DELETE');
  logger.start();

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('id');
    const fidParam = searchParams.get('fid');

    if (!listId || !fidParam) {
      return NextResponse.json({ error: 'List ID and fid are required' }, { status: 400 });
    }

    const fid = Number(fidParam);
    if (!fid || isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid' }, { status: 400 });
    }

    const parsedListId = parseInt(listId);
    if (isNaN(parsedListId)) {
      return NextResponse.json({ error: 'Invalid list ID' }, { status: 400 });
    }

    logger.info('Deleting list', { listId: parsedListId, fid });

    // Cascade delete handles items automatically, but explicit for clarity
    await db.query(`DELETE FROM curated_list_items WHERE list_id = $1`, [parsedListId]);
    await db.query(`DELETE FROM curated_lists WHERE id = $1 AND fid = $2`, [parsedListId, fid]);

    logger.success('List deleted', { listId: parsedListId });
    logger.end();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to delete list', error);
    return handleApiError(error, 'DELETE /curated-lists');
  }
}
