import { NextRequest, NextResponse } from "next/server";
import { publishReaction, deleteReaction } from '@/lib/farcaster-writes';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateHash } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/privy-like');
  logger.start();

  try {
    const body = await request.json();
    const { castHash, fid, targetCastFid } = body;

    // Validate input
    const validatedCastHash = validateHash(castHash, 'castHash');
    const castFid = fid ? Number(fid) : 0;

    logger.info('Publishing like', {
      castHash: validatedCastHash.substring(0, 10) + '...',
      fid: castFid,
    });

    // Publish like using app-managed signer (farcaster-writes)
    await publishReaction({
      reactionType: 'like',
      targetCastHash: validatedCastHash,
      targetCastFid: targetCastFid ? Number(targetCastFid) : 0,
      fid: castFid,
    });

    logger.success('Like published');
    logger.end();

    return NextResponse.json({ ok: true, data: { success: true } });
  } catch (error: any) {
    logger.error('Failed to like cast', error);
    return handleApiError(error, 'POST /privy-like');
  }
}

export async function DELETE(request: NextRequest) {
  const logger = createApiLogger('/privy-like [DELETE]');
  logger.start();

  try {
    const { searchParams } = new URL(request.url);
    const castHashParam = searchParams.get("castHash");
    const fidParam = searchParams.get("fid");
    const targetCastFidParam = searchParams.get("targetCastFid");

    // Validate input
    if (!castHashParam) {
      return NextResponse.json({ error: 'castHash is required' }, { status: 400 });
    }
    const validatedCastHash = validateHash(castHashParam, 'castHash');
    const castFid = fidParam ? Number(fidParam) : 0;

    logger.info('Removing like', {
      castHash: validatedCastHash.substring(0, 10) + '...',
      fid: castFid,
    });

    // Remove like using app-managed signer (farcaster-writes)
    await deleteReaction({
      reactionType: 'like',
      targetCastHash: validatedCastHash,
      targetCastFid: targetCastFidParam ? Number(targetCastFidParam) : 0,
      fid: castFid,
    });

    logger.success('Like removed');
    logger.end();

    return NextResponse.json({ ok: true, data: { success: true } });
  } catch (error: any) {
    logger.error('Failed to unlike cast', error);
    return handleApiError(error, 'DELETE /privy-like');
  }
}
