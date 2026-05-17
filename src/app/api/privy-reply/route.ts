import { NextRequest, NextResponse } from "next/server";
import { publishCast } from '@/lib/farcaster-writes';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateCastText, validateHash } from '@/lib/validation';
import { verifySignerAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/privy-reply');
  logger.start();

  try {
    const body = await request.json();
    const { text, parentHash, signerUuid } = body;

    // Validate inputs
    const validatedText = validateCastText(text);
    const validatedParentHash = validateHash(parentHash, 'parentHash');

    // Authenticate
    if (!signerUuid) {
      return NextResponse.json(
        { error: 'signerUuid is required' },
        { status: 401 }
      );
    }
    const verifiedFid = await verifySignerAuth(signerUuid);

    logger.info('Publishing reply', {
      textLength: validatedText.length,
      parentHash: validatedParentHash.substring(0, 10) + '...',
      fid: verifiedFid,
    });

    // Publish reply using farcaster-writes
    const result = await publishCast({
      text: validatedText,
      fid: verifiedFid || 0,
      parentCastHash: validatedParentHash,
    });

    logger.success('Reply published', { hash: result.castHash });
    logger.end();

    return NextResponse.json({ ok: true, cast: { hash: result.castHash } });
  } catch (error: any) {
    logger.error('Failed to publish reply', error);
    return handleApiError(error, 'POST /privy-reply');
  }
}
