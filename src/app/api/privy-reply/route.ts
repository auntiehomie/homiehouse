import { NextRequest, NextResponse } from "next/server";
import { publishCast } from '@/lib/farcaster-writes';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateCastText, validateHash } from '@/lib/validation';
import { verifyPrivyAuth } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/ratelimit';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/privy-reply');
  logger.start();

  try {
    // Verify auth token
    const claims = await verifyPrivyAuth(request);
    
    // Rate limit: 20 replies per minute per user
    const userId = claims?.userId || 'unknown';
    await enforceRateLimit({ key: `reply:${userId}`, limit: 20, windowSeconds: 60, label: 'reply' });
    
    const body = await request.json();
    const { text, parentHash, parentCastHash, fid, parentCastFid, signerPrivateKey } = body;

    // Support both parentHash and parentCastHash field names
    const resolvedParentHash = parentCastHash || parentHash;

    // Validate inputs
    const validatedText = validateCastText(text);
    const validatedParentHash = validateHash(resolvedParentHash, 'parentHash');

    const castFid = fid ? Number(fid) : 0;

    logger.info('Publishing reply', {
      textLength: validatedText.length,
      parentHash: validatedParentHash.substring(0, 10) + '...',
      fid: castFid,
    });

    // Publish reply using app-managed signer (farcaster-writes)
    const result = await publishCast({
      text: validatedText,
      fid: castFid,
      parentCastHash: validatedParentHash,
      signerPrivateKey: signerPrivateKey || undefined,
    });

    logger.success('Reply published', { hash: result.castHash });
    logger.end();

    return NextResponse.json({ ok: true, cast: { hash: result.castHash } });
  } catch (error: any) {
    logger.error('Failed to publish reply', error);
    return handleApiError(error, 'POST /privy-reply');
  }
}
