import { NextRequest, NextResponse } from "next/server";
import { publishReaction, deleteReaction, neynarFetch } from '@/lib/neynar';
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
    const { castHash, signerUuid } = body;

    const validatedCastHash = validateHash(castHash, 'castHash');

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

    logger.info('Publishing recast', { castHash: validatedCastHash.substring(0, 10) + '...' });

    const data = await publishReaction({
      signer_uuid: signerUuid,
      reaction_type: 'recast',
      target: validatedCastHash,
    });

    logger.success('Recast published');
    logger.end();
    return NextResponse.json({ ok: true, data });
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
    const signerUuid = searchParams.get("signerUuid");

    const validatedCastHash = validateHash(castHashParam!, 'castHash');

    if (!signerUuid) {
      return NextResponse.json({ error: 'signerUuid is required' }, { status: 400 });
    }

    // Verify signer
    try {
      const signerData = await neynarFetch(`/signer?signer_uuid=${encodeURIComponent(signerUuid)}`);
      if (!signerData?.fid) {
        return NextResponse.json({ error: 'Invalid signer' }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: 'Unable to verify signer' }, { status: 401 });
    }

    logger.info('Removing recast', { castHash: validatedCastHash.substring(0, 10) + '...' });

    const data = await deleteReaction({
      signer_uuid: signerUuid,
      reaction_type: 'recast',
      target: validatedCastHash,
    });

    logger.success('Recast removed');
    logger.end();
    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    logger.error('Failed to remove recast', error);
    return handleApiError(error, 'DELETE /recast');
  }
}
