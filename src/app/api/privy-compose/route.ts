import { NextRequest, NextResponse } from "next/server";
import { publishCast } from '@/lib/neynar';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateCastText, validateEmbeds, validateChannelKey } from '@/lib/validation';
import { verifySignerAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/privy-compose');
  logger.start();

  try {
    const body = await request.json();
    const { text, embeds, channelKey, parentUrl, signerUuid } = body;

    logger.info('Compose request', {
      textLength: text?.length,
      embedCount: embeds?.length,
      channelKey,
      hasParent: !!parentUrl,
      signerProvided: !!signerUuid,
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

    const verifiedFid = await verifySignerAuth(signerUuid);

    logger.info('Using verified signer', {
      signerPrefix: signerUuid.substring(0, 8) + '...',
      fid: verifiedFid,
    });

    // Build cast payload
    const castPayload: any = {
      signer_uuid: signerUuid,
      text: validatedText,
    };

    if (validatedEmbeds.length > 0) {
      castPayload.embeds = validatedEmbeds;
    }

    if (parentUrl) {
      castPayload.parent = parentUrl;
    }

    if (channelKey) {
      castPayload.channel_id = channelKey;
      logger.info('Adding channel to cast', { channelKey });
    }

    // Publish cast using shared utility
    const result = await publishCast(castPayload);

    logger.success('Cast published successfully', {
      hash: result?.cast?.hash
    });
    logger.end();

    return NextResponse.json({
      ok: true,
      success: true,
      cast: result.cast,
    });

  } catch (error: any) {
    logger.error('Failed to publish cast', error);
    return handleApiError(error, 'POST /privy-compose');
  }
}
