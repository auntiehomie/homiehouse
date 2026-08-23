import { NextRequest, NextResponse } from "next/server";
import { publishReaction, deleteReaction } from '@/lib/farcaster-writes';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateHash } from '@/lib/validation';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/ratelimit';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/privy-like');
  logger.start();

  try {
    // Verify auth via signer key headers
    const authFid = await verifyFarcasterSignerAuth(request);
    
    const body = await request.json();
    const { castHash, fid, targetCastFid, signerPrivateKey } = body;
    
    // Rate limit: 30 likes per minute per user
    await enforceRateLimit({ key: `like:${authFid}`, limit: 30, windowSeconds: 60, label: 'like' });
    
    // Verify signer ownership if a specific FID is provided
    const castFid = fid ? Number(fid) : authFid;

    // Validate input
    const validatedCastHash = validateHash(castHash, 'castHash');

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
      signerPrivateKey: signerPrivateKey || undefined,
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
    const body = await request.json().catch(() => ({}));
    const { castHash: castHashParam, fid: fidParam, targetCastFid: targetCastFidParam, signerPrivateKey } = body;

    // Validate input
    if (!castHashParam && !body.targetCastHash) {
      return NextResponse.json({ error: 'castHash is required' }, { status: 400 });
    }
    const validatedCastHash = validateHash(castHashParam || body.targetCastHash, 'castHash');
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
      signerPrivateKey: signerPrivateKey || undefined,
    });

    logger.success('Like removed');
    logger.end();

    return NextResponse.json({ ok: true, data: { success: true } });
  } catch (error: any) {
    logger.error('Failed to unlike cast', error);
    return handleApiError(error, 'DELETE /privy-like');
  }
}