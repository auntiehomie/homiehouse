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

    // For quote casts: embed the cast URL (already in embeds from client)
    // and optionally set parent_cast_id for platforms that support it.
    // We do NOT set parent here because that would make it a reply, not a quote.
    if (parentCastHash && isQuoteCast) {
      logger.info('Quote cast detected', { parentCastHash });
      // The cast URL embed is already included via `embeds` from the client.
      // Some Farcaster clients also look for a cast embed object shape;
      // we surface this in metadata for forward-compat.
      if (!castPayload.embeds) castPayload.embeds = [];
      // Ensure the warpcast conversation URL is in embeds (added client-side,
      // but guard here in case it was omitted)
      const quotedUrl = `https://warpcast.com/~/conversations/${parentCastHash}`;
      const alreadyHasEmbed = castPayload.embeds.some((e: any) => e.url === quotedUrl);
      if (!alreadyHasEmbed) {
        castPayload.embeds.push({ url: quotedUrl });
      }
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
