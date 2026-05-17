import { NextRequest, NextResponse } from "next/server";
import { publishReaction, deleteReaction } from '@/lib/farcaster-writes';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateHash } from '@/lib/validation';
import { verifySignerAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/privy-recast');
  logger.start();

  try {
    const body = await request.json();
    const { castHash, signerUuid } = body;

    // Validate input
    const validatedCastHash = validateHash(castHash, 'castHash');

    // Authenticate
    if (!signerUuid) {
      return NextResponse.json(
        { error: 'signerUuid is required' },
        { status: 401 }
      );
    }
    const verifiedFid = await verifySignerAuth(signerUuid);

    logger.info('Publishing recast', {
      castHash: validatedCastHash.substring(0, 10) + '...',
      fid: verifiedFid,
    });

    // Publish recast using farcaster-writes
    await publishReaction({
      reactionType: 'recast',
      targetCastHash: validatedCastHash,
      targetCastFid: 0, // unknown without lookup; hub will resolve
      fid: verifiedFid || 0,
    });
    const data = { success: true };

    logger.success('Recast published');
    logger.end();

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    logger.error('Failed to recast', error);
    return handleApiError(error, 'POST /privy-recast');
  }
}

export async function DELETE(request: NextRequest) {
  const logger = createApiLogger('/privy-recast [DELETE]');
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

    logger.info('Removing recast', {
      castHash: validatedCastHash.substring(0, 10) + '...',
      fid: verifiedFid,
    });

    // Remove recast using farcaster-writes
    await deleteReaction({
      reactionType: 'recast',
      targetCastHash: validatedCastHash,
      targetCastFid: 0, // unknown without lookup; hub will resolve
      fid: verifiedFid || 0,
    });
    const data = { success: true };

    logger.success('Recast removed');
    logger.end();

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    logger.error('Failed to remove recast', error);
    return handleApiError(error, 'DELETE /privy-recast');
  }
}
