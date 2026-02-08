import { NextRequest, NextResponse } from "next/server";
import { publishCast, neynarFetch } from '@/lib/neynar';
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
    const { text, parentHash, signerUuid } = body;

    const validatedText = validateCastText(text);
    const validatedParentHash = validateHash(parentHash, 'parentHash');

    if (!signerUuid) {
      return NextResponse.json({ error: 'signerUuid is required' }, { status: 400 });
    }

    // Verify signer exists and is valid via Neynar
    try {
      const signerData = await neynarFetch(`/signer?signer_uuid=${encodeURIComponent(signerUuid)}`);
      if (!signerData?.fid) {
        return NextResponse.json({ error: 'Invalid signer' }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: 'Unable to verify signer' }, { status: 401 });
    }

    logger.info('Publishing reply', {
      textLength: validatedText.length,
      parentHash: validatedParentHash.substring(0, 10) + '...'
    });

    const result = await publishCast({
      signer_uuid: signerUuid,
      text: validatedText,
      parent: validatedParentHash,
    });

    logger.success('Reply published', { hash: result?.cast?.hash });
    logger.end();
    return NextResponse.json({ ok: true, cast: result.cast });
  } catch (error: any) {
    logger.error('Failed to publish reply', error);
    return handleApiError(error, 'POST /reply');
  }
}
