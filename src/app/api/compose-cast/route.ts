import { NextRequest, NextResponse } from "next/server";
import { publishCast, neynarFetch } from '@/lib/neynar';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateCastText, validateEmbeds, validateChannelKey } from '@/lib/validation';
import { rateLimit } from '@/lib/ratelimit';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/compose-cast');
  logger.start();

  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { success: rateLimitOk } = rateLimit(`compose:${ip}`, 20, 3600);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited. Try again later.' }, { status: 429 });
    }

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

    const validatedText = validateCastText(text);
    const validatedEmbeds = validateEmbeds(embeds);

    if (channelKey) {
      validateChannelKey(channelKey);
    }

    if (!signerUuid) {
      logger.error('No signer UUID provided');
      return NextResponse.json(
        { error: "signerUuid is required. Please create a signer first." },
        { status: 400 }
      );
    }

    // Verify signer exists and is valid via Neynar
    let signerData;
    try {
      signerData = await neynarFetch(`/signer/${signerUuid}`);
      if (!signerData?.fid) {
        return NextResponse.json({ error: 'Invalid signer' }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: 'Unable to verify signer' }, { status: 401 });
    }

    logger.info('Signer verified', { fid: signerData.fid });

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
    }

    const result = await publishCast(castPayload);

    logger.success('Cast published successfully', { hash: result?.cast?.hash });
    logger.end();

    return NextResponse.json({
      ok: true,
      success: true,
      cast: result.cast,
    });
  } catch (error: any) {
    logger.error('Failed to publish cast', error);
    return handleApiError(error, 'POST /compose-cast');
  }
}
