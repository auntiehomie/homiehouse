import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const logger = createApiLogger('/curated-lists');
  logger.start();

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');

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
