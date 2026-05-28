import { NextRequest, NextResponse } from "next/server";
import { publishCast } from '@/lib/farcaster-writes';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateCastText, validateHash } from '@/lib/validation';
import { rateLimit } from '@/lib/ratelimit';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/reply');
  logger.start();

  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { success: rateLimitOk } = rateLimit(`reply:${ip}`, 30, 3600);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited. Try again later.' }, { status: 429 });
    }

    const body = await request.json();
    const { text, parentHash, fid, parentCastFid } = body;

    const validatedText = validateCastText(text);
    const validatedParentHash = validateHash(parentHash, 'parentHash');
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
    });

    logger.success('Reply published', { hash: result.castHash });
    logger.end();
    return NextResponse.json({ ok: true, cast: { hash: result.castHash } });
  } catch (error: any) {
    logger.error('Failed to publish reply', error);
    return handleApiError(error, 'POST /reply');
  }
}
