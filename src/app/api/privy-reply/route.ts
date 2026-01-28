import { NextRequest, NextResponse } from "next/server";
import { publishCast } from '@/lib/neynar';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateCastText, validateHash } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/privy-reply');
  logger.start();

  try {
    const body = await request.json();
    const { text, parentHash } = body;

    // Validate inputs
    const validatedText = validateCastText(text);
    const validatedParentHash = validateHash(parentHash, 'parentHash');

    logger.info('Publishing reply', { 
      textLength: validatedText.length,
      parentHash: validatedParentHash.substring(0, 10) + '...'
    });

    const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;
    if (!NEYNAR_SIGNER_UUID) {
      logger.error('NEYNAR_SIGNER_UUID not configured');
      return NextResponse.json(
        { error: "Neynar signer not configured" },
        { status: 500 }
      );
    }

    // Publish reply using shared utility
    const result = await publishCast({
      signer_uuid: NEYNAR_SIGNER_UUID,
      text: validatedText,
      parent: validatedParentHash,
    });

    logger.success('Reply published', { hash: result?.cast?.hash });
    logger.end();

    return NextResponse.json({ ok: true, cast: result.cast });
  } catch (error: any) {
    logger.error('Failed to publish reply', error);
    return handleApiError(error, 'POST /privy-reply');
  }
}
