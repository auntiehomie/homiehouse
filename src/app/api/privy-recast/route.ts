import { NextRequest, NextResponse } from "next/server";
import { publishReaction, deleteReaction } from '@/lib/neynar';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateHash } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/privy-recast');
  logger.start();

  try {
    const body = await request.json();
    const { castHash } = body;

    // Validate input
    const validatedCastHash = validateHash(castHash, 'castHash');

    logger.info('Publishing recast', { 
      castHash: validatedCastHash.substring(0, 10) + '...'
    });

    const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;
    if (!NEYNAR_SIGNER_UUID) {
      logger.error('NEYNAR_SIGNER_UUID not configured');
      return NextResponse.json(
        { error: "Neynar signer not configured" },
        { status: 500 }
      );
    }

    // Publish recast using shared utility
    const data = await publishReaction({
      signer_uuid: NEYNAR_SIGNER_UUID,
      reaction_type: 'recast',
      target: validatedCastHash,
    });

    logger.success('Recast published');
    logger.end();

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    logger.error('Failed to recast', error);
    return handleApiError(error, 'POST /privy-recast');
  }
}

export async function DELETE(request: NextRequest) {
  const logger = createApiLogger('/privy-recast [DELETE]');
  logger.start();

  try {
    const { searchParams } = new URL(request.url);
    const castHashParam = searchParams.get("castHash");

    // Validate input
    const validatedCastHash = validateHash(castHashParam!, 'castHash');

    logger.info('Removing recast', { 
      castHash: validatedCastHash.substring(0, 10) + '...'
    });

    const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;
    if (!NEYNAR_SIGNER_UUID) {
      logger.error('NEYNAR_SIGNER_UUID not configured');
      return NextResponse.json(
        { error: "Neynar signer not configured" },
        { status: 500 }
      );
    }

    // Remove recast using shared utility
    const data = await deleteReaction({
      signer_uuid: NEYNAR_SIGNER_UUID,
      reaction_type: 'recast',
      target: validatedCastHash,
    });

    logger.success('Recast removed');
    logger.end();

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    logger.error('Failed to remove recast', error);
    return handleApiError(error, 'DELETE /privy-recast');
  }
}
