import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/curate-cast');
  logger.start();

  try {
    const db = getDb();
    const body = await request.json();
    const { fid, listName, castHash, castData, notes } = body;

    if (!fid || !listName || !castHash) {
      return NextResponse.json(
        { error: 'fid, listName, and castHash are required' },
        { status: 400 }
      );
    }

    const validatedFid = Number(fid);
    if (!validatedFid || isNaN(validatedFid)) {
      return NextResponse.json({ error: 'Invalid fid' }, { status: 400 });
    }

    logger.info('Curating cast', { fid: validatedFid, listName, castHash });

    // Find or create list
    let listId: number;
    const { rows: existingLists } = await db.query(
      `SELECT id FROM curated_lists WHERE fid = $1 AND list_name = $2`,
      [validatedFid, listName]
    );

    if (existingLists.length > 0) {
      listId = existingLists[0].id;
      logger.info('Found existing list', { listId });
    } else {
      try {
        const { rows: newList } = await db.query(
          `INSERT INTO curated_lists (fid, list_name, description, is_public)
           VALUES ($1, $2, $3, false)
           RETURNING id, list_name`,
          [validatedFid, listName, `Curated collection: ${listName}`]
        );
        listId = newList[0].id;
        logger.info('Created new list', { listId });
      } catch (err: any) {
        logger.error('Failed to create list', err);
        return NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
      }
    }

    // Check if already in list
    const { rows: existingItem } = await db.query(
      `SELECT id FROM curated_list_items WHERE list_id = $1 AND cast_hash = $2`,
      [listId, castHash]
    );

    if (existingItem.length > 0) {
      logger.info('Cast already in list', { castHash, listId });
      return NextResponse.json({
        success: true,
        message: 'Cast already in list',
        listId,
        listName,
        alreadyAdded: true,
      });
    }

    // Add cast
    try {
      const { rows: newItem } = await db.query(
        `INSERT INTO curated_list_items
          (list_id, cast_hash, cast_author_fid, cast_text, cast_timestamp, added_by_fid, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          listId,
          castHash,
          castData?.authorFid || castData?.author_fid || null,
          castData?.text || null,
          castData?.timestamp || null,
          validatedFid,
          notes || null,
        ]
      );

      logger.success('Cast added to list', { listId, castHash });
      logger.end();

      return NextResponse.json({
        success: true,
        message: `Added to "${listName}"`,
        listId,
        listName,
        item: newItem[0],
        alreadyAdded: false,
      });
    } catch (err: any) {
      logger.error('Failed to add cast to list', err);
      return NextResponse.json({ error: 'Failed to add cast to list' }, { status: 500 });
    }
  } catch (error: any) {
    logger.error('Failed to curate cast', error);
    return handleApiError(error, 'POST /curate-cast');
  }
}
