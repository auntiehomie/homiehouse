import { NextRequest, NextResponse } from "next/server";
import { publishCast } from '@/lib/neynar';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateCastText, validateEmbeds, validateChannelKey } from '@/lib/validation';
import { verifySignerOwnership, getOptionalAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/privy-compose');
  logger.start();

  try {
    const body = await request.json();
    const { text, embeds, channelKey, parentUrl, signerUuid, fid } = body;

    logger.info('Compose request', { 
      textLength: text?.length,
      embedCount: embeds?.length,
      channelKey,
      hasParent: !!parentUrl,
      signerProvided: !!signerUuid,
      fid
    });

    // Validate inputs
    const validatedText = validateCastText(text);
    const validatedEmbeds = validateEmbeds(embeds);
    
    if (channelKey) {
      validateChannelKey(channelKey);
    }

    // Get authenticated user (if available)
    const authToken = getOptionalAuth(request);
    
    // Use user's signer if provided, otherwise fallback to bot signer
    const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;
    const effectiveSignerUuid = signerUuid || NEYNAR_SIGNER_UUID;
    
    if (!effectiveSignerUuid) {
      logger.error('No signer UUID available');
      return NextResponse.json(
        { error: "No signer UUID available. Please create a signer first." },
        { status: 400 }
      );
    }

    // TODO: Verify signer ownership if user is authenticated
    if (authToken && signerUuid) {
      logger.warn('Signer ownership verification not implemented', {
        signerUuid: signerUuid.substring(0, 8) + '...'
      });
      // await verifySignerOwnership(signerUuid, authToken);
    }

    logger.info('Using signer', { 
      signerPrefix: effectiveSignerUuid.substring(0, 8) + '...',
      fid: fid || 'not specified'
    });

    // Build cast payload
    const castPayload: any = {
      signer_uuid: effectiveSignerUuid,
      text: validatedText,
    };

    if (validatedEmbeds.length > 0) {
      castPayload.embeds = validatedEmbeds;
    }

    if (parentUrl) {
      castPayload.parent = parentUrl;
    }

    if (channelKey) {
      castPayload.channel_key = channelKey;
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
