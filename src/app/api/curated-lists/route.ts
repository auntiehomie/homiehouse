import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { neynarFetch } from '@/lib/neynar';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const logger = createApiLogger('/curated-lists');
  logger.start();

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const signerUuid = searchParams.get('signerUuid');

    if (!signerUuid) {
      return NextResponse.json({ error: 'signerUuid is required' }, { status: 400 });
    }

    let fid: number;
    try {
      const signerData = await neynarFetch(`/signer?signer_uuid=${encodeURIComponent(signerUuid)}`);
      if (!signerData?.fid) return NextResponse.json({ error: 'Invalid signer' }, { status: 401 });
      fid = signerData.fid;
    } catch {
      return NextResponse.json({ error: 'Unable to verify signer' }, { status: 401 });
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
    const { signerUuid, listName, description, isPublic } = body;

    if (!signerUuid || !listName) {
      return NextResponse.json({ error: 'signerUuid and listName are required' }, { status: 400 });
    }

    let validatedFid: number;
    try {
      const signerData = await neynarFetch(`/signer?signer_uuid=${encodeURIComponent(signerUuid)}`);
      if (!signerData?.fid) return NextResponse.json({ error: 'Invalid signer' }, { status: 401 });
      validatedFid = signerData.fid;
    } catch {
      return NextResponse.json({ error: 'Unable to verify signer' }, { status: 401 });
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
    const signerUuid = searchParams.get('signerUuid');

    if (!listId || !signerUuid) {
      return NextResponse.json({ error: 'List ID and signerUuid are required' }, { status: 400 });
    }

    let fid: number;
    try {
      const signerData = await neynarFetch(`/signer?signer_uuid=${encodeURIComponent(signerUuid)}`);
      if (!signerData?.fid) return NextResponse.json({ error: 'Invalid signer' }, { status: 401 });
      fid = signerData.fid;
    } catch {
      return NextResponse.json({ error: 'Unable to verify signer' }, { status: 401 });
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
