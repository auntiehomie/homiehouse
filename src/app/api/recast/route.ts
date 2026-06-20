import { NextRequest, NextResponse } from "next/server";
import { publishReaction, deleteReaction } from '@/lib/farcaster-writes';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateHash } from '@/lib/validation';
import { rateLimit } from '@/lib/ratelimit';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/recast');
  logger.start();

  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { success: rateLimitOk } = rateLimit(`recast:${ip}`, 60, 3600);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited. Try again later.' }, { status: 429 });
    }

    const body = await request.json();
    const { castHash, fid, targetCastFid } = body;

    const validatedCastHash = validateHash(castHash, 'castHash');
    const castFid = fid ? Number(fid) : 0;

    logger.info('Publishing recast', { castHash: validatedCastHash.substring(0, 10) + '...', fid: castFid });

    await publishReaction({
      reactionType: 'recast',
      targetCastHash: validatedCastHash,
      targetCastFid: targetCastFid ? Number(targetCastFid) : 0,
      fid: castFid,
    });

    logger.success('Recast published');
    logger.end();
    return NextResponse.json({ ok: true, data: { success: true } });
  } catch (error: any) {
    logger.error('Failed to recast', error);
    return handleApiError(error, 'POST /recast');
  }
}

export async function DELETE(request: NextRequest) {
  const logger = createApiLogger('/recast [DELETE]');
  logger.start();

  try {
    const { searchParams } = new URL(request.url);
    const castHashParam = searchParams.get("castHash");
    const fidParam = searchParams.get("fid");
    const targetCastFidParam = searchParams.get("targetCastFid");

    const validatedCastHash = validateHash(castHashParam!, 'castHash');
    const castFid = fidParam ? Number(fidParam) : 0;

    logger.info('Removing recast', { castHash: validatedCastHash.substring(0, 10) + '...', fid: castFid });

    await deleteReaction({
      reactionType: 'recast',
      targetCastHash: validatedCastHash,
      targetCastFid: targetCastFidParam ? Number(targetCastFidParam) : 0,
      fid: castFid,
    });

    logger.success('Recast removed');
    logger.end();
    return NextResponse.json({ ok: true, data: { success: true } });
  } catch (error: any) {
    logger.error('Failed to remove recast', error);
    return handleApiError(error, 'DELETE /recast');
  }
}
