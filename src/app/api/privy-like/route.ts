import { NextRequest, NextResponse } from "next/server";
import { publishReaction, deleteReaction } from '@/lib/farcaster-writes';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateHash } from '@/lib/validation';
import { verifySignerAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/privy-like');
  logger.start();

  try {
    const body = await request.json();
    const { castHash, signerUuid } = body;

    // Validate input
    const validatedCastHash = validateHash(castHash, 'castHash');

    // Authenticate: verify signer and get FID
    if (!signerUuid) {
      return NextResponse.json(
        { error: 'signerUuid is required' },
        { status: 401 }
      );
    }
    const verifiedFid = await verifySignerAuth(signerUuid);

    logger.info('Publishing like', {
      castHash: validatedCastHash.substring(0, 10) + '...',
      fid: verifiedFid,
    });

    // Publish like using farcaster-writes
    await publishReaction({
      reactionType: 'like',
      targetCastHash: validatedCastHash,
      targetCastFid: 0, // unknown without lookup; hub will resolve
      fid: verifiedFid || 0,
    });
    const data = { success: true };

    logger.success('Like published');
    logger.end();

    return NextResponse.json({ ok: true, data });
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
    const signerUuid = searchParams.get("signerUuid");

    // Validate input
    if (!castHashParam) {
      return NextResponse.json({ error: 'castHash is required' }, { status: 400 });
    }
    const validatedCastHash = validateHash(castHashParam, 'castHash');

    // Authenticate
    if (!signerUuid) {
      return NextResponse.json(
        { error: 'signerUuid is required' },
        { status: 401 }
      );
    }
    const verifiedFid = await verifySignerAuth(signerUuid);

    logger.info('Removing like', {
      castHash: validatedCastHash.substring(0, 10) + '...',
      fid: verifiedFid,
    });

    // Remove like using farcaster-writes
    await deleteReaction({
      reactionType: 'like',
      targetCastHash: validatedCastHash,
      targetCastFid: 0, // unknown without lookup; hub will resolve
      fid: verifiedFid || 0,
    });
    const data = { success: true };

    logger.success('Like removed');
    logger.end();

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    logger.error('Failed to unlike cast', error);
    return handleApiError(error, 'DELETE /privy-like');
  }
}
