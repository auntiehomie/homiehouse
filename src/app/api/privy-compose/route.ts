import { NextRequest, NextResponse } from "next/server";
import { publishCast } from '@/lib/farcaster-writes';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateCastText, validateEmbeds, validateChannelKey } from '@/lib/validation';
import { verifySignerAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/privy-compose');
  logger.start();

  try {
    const body = await request.json();
    const { text, embeds, channelKey, parentUrl, parentCastHash, isQuoteCast } = body;
    const signerUuid = body.signerUuid || body.signer_uuid;

    logger.info('Compose request', {
      textLength: text?.length,
      embedCount: embeds?.length,
      channelKey,
      hasParent: !!parentUrl,
      hasParentCastHash: !!parentCastHash,
      isQuoteCast: !!isQuoteCast,
      signerProvided: !!signerUuid,
      signerField: body.signerUuid ? 'signerUuid' : body.signer_uuid ? 'signer_uuid' : 'none',
    });

    // Validate inputs
    const validatedText = validateCastText(text);
    const validatedEmbeds = validateEmbeds(embeds);

    if (channelKey) {
      validateChannelKey(channelKey);
    }

    // Require signer authentication
    if (!signerUuid) {
      return NextResponse.json(
        { error: "signerUuid is required. Please sign in first." },
        { status: 401 }
      );
    }

    let verifiedFid;
    try {
      verifiedFid = await verifySignerAuth(signerUuid);
    } catch (authErr: any) {
      logger.error('Signer verification failed', authErr);
      console.error('[SIGNER_AUTH_ERROR]', {
        message: authErr?.message,
        code: authErr?.code,
        status: authErr?.status,
        signerUuidLength: signerUuid.length,
        signerUuidPrefix: signerUuid.substring(0, 8),
      });
      throw authErr;
    }

    logger.info('Using verified signer', {
      signerPrefix: signerUuid.substring(0, 8) + '...',
      fid: verifiedFid,
      signerUuidLength: signerUuid.length,
    });

    // Build cast payload for farcaster-writes
    let embedsForCast = validatedEmbeds.length > 0 ? validatedEmbeds : undefined;

    // For quote casts: ensure the warpcast conversation URL is in embeds
    if (parentCastHash && isQuoteCast) {
      logger.info('Quote cast detected', { parentCastHash });
      const quotedUrl = `https://warpcast.com/~/conversations/${parentCastHash}`;
      if (!embedsForCast) embedsForCast = [];
      const alreadyHasEmbed = embedsForCast.some((e: any) => e.url === quotedUrl);
      if (!alreadyHasEmbed) {
        embedsForCast = [...embedsForCast, { url: quotedUrl }];
      }
    }

    if (channelKey) {
      logger.info('Adding channel to cast', { channelKey });
    }

    // Publish cast using farcaster-writes
    const result = await publishCast({
      text: validatedText,
      fid: verifiedFid || 0,
      embeds: embedsForCast,
      parentCastHash: parentCastHash && !isQuoteCast ? parentCastHash : undefined,
      parentUrl: parentUrl || undefined,
      channelKey: channelKey || undefined,
    });

    logger.success('Cast published successfully', {
      hash: result.castHash,
    });
    logger.end();

    return NextResponse.json({
      ok: true,
      success: true,
      cast: { hash: result.castHash },
    });

  } catch (error: any) {
    logger.error('Failed to publish cast', error);
    return handleApiError(error, 'POST /privy-compose');
  }
}
