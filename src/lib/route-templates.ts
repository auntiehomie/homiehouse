/**
 * Example templates for updating API routes with new utilities
 * Copy and modify these examples for your routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { hypersnapFetch } from '@/lib/hypersnap';
import { publishCast, publishReaction } from '@/lib/farcaster-writes';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateCastText, validateHash, validateFid } from '@/lib/validation';
import { verifyCronSecret } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';

// ============================================
// EXAMPLE 1: Simple GET endpoint with Hypersnap
// ============================================
export async function exampleSimpleGet(request: NextRequest) {
  const logger = createApiLogger('/example-simple-get');
  logger.start();

  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');

    // Validate inputs
    const fid = validateFid(fidParam);

    logger.info('Fetching data', { fid });

    // Use Hypersnap for reads
    const data = await hypersnapFetch(`/v2/farcaster/user/bulk?fids=${fid}`);

    logger.success('Data fetched');
    logger.end();

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Failed to fetch data', error);
    return handleApiError(error, 'GET /example-simple-get');
  }
}

// ============================================
// EXAMPLE 2: POST endpoint with farcaster-writes
// ============================================
export async function examplePost(request: NextRequest) {
  const logger = createApiLogger('/example-post');
  logger.start();

  try {
    // Parse body
    const body = await request.json();

    // Validate all inputs
    const text = validateCastText(body.text);
    const castHash = validateHash(body.castHash, 'castHash');
    const fid = body.fid ? Number(body.fid) : 0;

    logger.info('Publishing cast', { textLength: text.length, fid });

    // Use farcaster-writes (app-managed signer)
    const result = await publishCast({
      text,
      fid,
      parentCastHash: castHash,
    });

    logger.success('Cast published', { hash: result.castHash });
    logger.end();

    return NextResponse.json({ ok: true, cast: { hash: result.castHash } });
  } catch (error) {
    logger.error('Failed to publish cast', error);
    return handleApiError(error, 'POST /example-post');
  }
}

// ============================================
// EXAMPLE 3: Reaction endpoint (like/recast)
// ============================================
export async function exampleReaction(request: NextRequest) {
  const logger = createApiLogger('/example-reaction');
  logger.start();

  try {
    const body = await request.json();
    const castHash = validateHash(body.castHash, 'castHash');
    const reactionType = body.type === 'recast' ? 'recast' : 'like';
    const fid = body.fid ? Number(body.fid) : 0;

    logger.info('Publishing reaction', { reactionType, fid });

    await publishReaction({
      reactionType,
      targetCastHash: castHash,
      targetCastFid: body.targetCastFid ? Number(body.targetCastFid) : 0,
      fid,
    });

    logger.success('Reaction published');
    logger.end();

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Failed to publish reaction', error);
    return handleApiError(error, 'POST /example-reaction');
  }
}

// ============================================
// EXAMPLE 4: CRON job endpoint
// ============================================
export async function exampleCronJob(request: NextRequest) {
  const logger = createApiLogger('/example-cron');

  try {
    // Verify CRON secret
    verifyCronSecret(request, process.env.CRON_SECRET);

    logger.start();
    logger.info('Running scheduled task');

    // Your scheduled task logic
    const result = await performScheduledTask();

    logger.success('Task completed', { result });
    logger.end();

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error) {
    logger.error('Task failed', error);
    return handleApiError(error, 'GET /example-cron');
  }
}

// ============================================
// EXAMPLE 5: Rate limited endpoint
// ============================================
export async function exampleRateLimited(request: NextRequest) {
  const logger = createApiLogger('/example-rate-limited');
  logger.start();

  try {
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';

    // Check rate limit: 10 requests per minute
    const { success: rlOk } = rateLimit(`api:compose:${ip}`, 10, 60);
    if (!rlOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const body = await request.json();
    const text = validateCastText(body.text);
    const fid = body.fid ? Number(body.fid) : 0;

    logger.info('Publishing cast (rate limited)', { ip, fid });

    const result = await publishCast({ text, fid });

    logger.success('Cast published');
    logger.end();

    return NextResponse.json({ ok: true, cast: { hash: result.castHash } });
  } catch (error) {
    logger.error('Failed to publish cast', error);
    return handleApiError(error, 'POST /example-rate-limited');
  }
}

// Placeholder for scheduled task
async function performScheduledTask() {
  // Your task logic
  return { processed: 0 };
}
