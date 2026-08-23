import { NextRequest, NextResponse } from "next/server";
import { publishReaction, deleteReaction } from '@/lib/farcaster-writes';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateHash } from '@/lib/validation';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/ratelimit';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/privy-recast');
  logger.start();

  try {
    // Verify auth via signer key headers
    const authFid = await verifyFarcasterSignerAuth(request);
    
    const body = await request.json();
    const { castHash, fid, targetCastFid, signerPrivateKey } = body;
    
    // Rate limit: 20 recasts per minute per user
    await enforceRateLimit({ key: `recast:${authFid}`, limit: 20, windowSeconds: 60, label: 'recast' });
    
    // Verify signer ownership if a specific FID is provided
    const castFid = fid ? Number(fid) : authFid;

    // Validate input
    const validatedCastHash = validateHash(castHash, 'castHash');

    logger.info('Publishing recast', {
      castHash: validatedCastHash.substring(0, 10) + '...',
      fid: castFid,
    });

    // Publish recast using app-managed signer (farcaster-writes)
    await publishReaction({
      reactionType: 'recast',
      targetCastHash: validatedCastHash,
      targetCastFid: targetCastFid ? Number(targetCastFid) : 0,
      fid: castFid,
      signerPrivateKey: signerPrivateKey || undefined,
    });

    logger.success('Recast published');
    logger.end();

    return NextResponse.json({ ok: true, data: { success: true } });
  } catch (error: any) {
    logger.error('Failed to recast', error);
    return handleApiError(error, 'POST /privy-recast');
  }
}

export async function DELETE(request: NextRequest) {
  const logger = createApiLogger('/privy-recast [DELETE]');
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

    logger.info('Removing recast', {
      castHash: validatedCastHash.substring(0, 10) + '...',
      fid: castFid,
    });

    await deleteReaction({
      reactionType: 'recast',
      targetCastHash: validatedCastHash,
      targetCastFid: targetCastFidParam ? Number(targetCastFidParam) : 0,
      fid: castFid,
      signerPrivateKey: signerPrivateKey || undefined,
    });

    logger.success('Recast removed');
    logger.end();

    return NextResponse.json({ ok: true, data: { success: true } });
  } catch (error: any) {
    logger.error('Failed to remove recast', error);
    return handleApiError(error, 'DELETE /privy-recast');
  }
}