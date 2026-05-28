import { NextRequest, NextResponse } from "next/server";
import { publishCast } from '@/lib/farcaster-writes';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateCastText, validateEmbeds, validateChannelKey } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/privy-compose');
  logger.start();

  try {
    const body = await request.json();
    const { text, embeds, channelKey, parentUrl, parentCastHash, isQuoteCast, fid } = body;

    logger.info('Compose request', {
      textLength: text?.length,
      embedCount: embeds?.length,
      channelKey,
      hasParent: !!parentUrl,
      hasParentCastHash: !!parentCastHash,
      isQuoteCast: !!isQuoteCast,
      fid,
    });

    // Validate inputs
    const validatedText = validateCastText(text);
    const validatedEmbeds = validateEmbeds(embeds);

    if (channelKey) {
      validateChannelKey(channelKey);
    }

    // Require fid from the client (from Privy user object)
    const castFid = fid ? Number(fid) : 0;

    logger.info('Publishing cast', { fid: castFid });

    // Build embeds
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

    // Publish cast using farcaster-writes (app-managed signer)
    const result = await publishCast({
      text: validatedText,
      fid: castFid,
      embeds: embedsForCast,
      parentCastHash: parentCastHash && !isQuoteCast ? parentCastHash : undefined,
      parentUrl: parentUrl || undefined,
      channelKey: channelKey || undefined,
    });

    logger.success('Cast published successfully', { hash: result.castHash });
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
