/**
 * Example templates for updating API routes with new utilities
 * Copy and modify these examples for your routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { neynarFetch, publishCast, publishReaction } from '@/lib/neynar';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateCastText, validateHash, validateFid } from '@/lib/validation';
import { verifyBearerToken, getOptionalAuth, checkRateLimit } from '@/lib/auth';

// ============================================
// EXAMPLE 1: Simple GET endpoint with Neynar
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
    
    // Use shared Neynar utility (automatically handles errors)
    const data = await neynarFetch(`/user?fid=${fid}`);
    
    logger.success('Data fetched');
    logger.end();
    
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Failed to fetch data', error);
    return handleApiError(error, 'GET /example-simple-get');
  }
}

// ============================================
// EXAMPLE 2: POST endpoint with validation
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
    
    logger.info('Publishing cast', { textLength: text.length });
    
    // Use shared utility function
    const result = await publishCast({
      signer_uuid: process.env.NEYNAR_SIGNER_UUID!,
      text,
      parent: castHash,
    });
    
    logger.success('Cast published', { hash: result.cast?.hash });
    logger.end();
    
    return NextResponse.json({ ok: true, cast: result.cast });
  } catch (error) {
    logger.error('Failed to publish cast', error);
    return handleApiError(error, 'POST /example-post');
  }
}

// ============================================
// EXAMPLE 3: Authenticated endpoint
// ============================================
export async function exampleAuthRequired(request: NextRequest) {
  const logger = createApiLogger('/example-auth');
  logger.start();

  try {
    // Require authentication
    const token = verifyBearerToken(request);
    
    // TODO: Get user ID from token
    // const userId = await getUserIdFromToken(token);
    
    logger.info('Authenticated request');
    
    // Your logic here
    
    logger.end();
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Authentication failed', error);
    return handleApiError(error, 'POST /example-auth');
  }
}

// ============================================
// EXAMPLE 4: Optional auth (different behavior for logged in users)
// ============================================
export async function exampleOptionalAuth(request: NextRequest) {
  const logger = createApiLogger('/example-optional-auth');
  logger.start();

  try {
    // Get auth token if present (returns null if not)
    const token = getOptionalAuth(request);
    
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const fid = validateFid(fidParam);
    
    // Fetch data with or without viewer context
    const params: any = { fid };
    if (token) {
      // TODO: Get viewer FID from token
      // params.viewer_fid = viewerFid;
      logger.info('Authenticated request', { fid });
    } else {
      logger.info('Public request', { fid });
    }
    
    const data = await neynarFetch('/feed', { 
      method: 'GET'
      // Build query params as needed
    });
    
    logger.end();
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Request failed', error);
    return handleApiError(error, 'GET /example-optional-auth');
  }
}

// ============================================
// EXAMPLE 5: Rate limited endpoint
// ============================================
export async function exampleRateLimited(request: NextRequest) {
  const logger = createApiLogger('/example-rate-limited');
  logger.start();

  try {
    // Get identifier for rate limiting (IP, user ID, etc.)
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    // Check rate limit: 10 requests per minute
    await checkRateLimit(`api:compose:${ip}`, 10, 60);
    
    const body = await request.json();
    const text = validateCastText(body.text);
    
    logger.info('Publishing cast (rate limited)', { ip });
    
    const result = await publishCast({
      signer_uuid: process.env.NEYNAR_SIGNER_UUID!,
      text,
    });
    
    logger.success('Cast published');
    logger.end();
    
    return NextResponse.json({ ok: true, cast: result.cast });
  } catch (error) {
    logger.error('Failed to publish cast', error);
    return handleApiError(error, 'POST /example-rate-limited');
  }
}

// ============================================
// EXAMPLE 6: CRON job endpoint
// ============================================
export async function exampleCronJob(request: NextRequest) {
  const logger = createApiLogger('/example-cron');
  
  try {
    // Verify CRON secret
    const { verifyCronSecret } = await import('@/lib/auth');
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
// EXAMPLE 7: Multiple validations
// ============================================
export async function exampleMultipleValidations(request: NextRequest) {
  const logger = createApiLogger('/example-validations');
  logger.start();

  try {
    const body = await request.json();
    
    // Validate multiple inputs
    const { 
      validateCastText, 
      validateEmbeds, 
      validateChannelKey,
      validateUrl 
    } = await import('@/lib/validation');
    
    const text = validateCastText(body.text);
    const embeds = validateEmbeds(body.embeds);
    
    // Optional validations
    if (body.channelKey) {
      validateChannelKey(body.channelKey);
    }
    
    if (body.parentUrl) {
      validateUrl(body.parentUrl, 'parentUrl');
    }
    
    logger.info('All validations passed', {
      textLength: text.length,
      embedCount: embeds.length,
      hasChannel: !!body.channelKey,
      hasParent: !!body.parentUrl,
    });
    
    // Your logic here
    
    logger.end();
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Validation failed', error);
    return handleApiError(error, 'POST /example-validations');
  }
}

// ============================================
// EXAMPLE 8: Reaction endpoint (like/recast)
// ============================================
export async function exampleReaction(request: NextRequest) {
  const logger = createApiLogger('/example-reaction');
  logger.start();

  try {
    const body = await request.json();
    const castHash = validateHash(body.castHash, 'castHash');
    const reactionType = body.type === 'recast' ? 'recast' : 'like';
    
    logger.info('Publishing reaction', { reactionType });
    
    const result = await publishReaction({
      signer_uuid: process.env.NEYNAR_SIGNER_UUID!,
      reaction_type: reactionType,
      target: castHash,
    });
    
    logger.success('Reaction published');
    logger.end();
    
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    logger.error('Failed to publish reaction', error);
    return handleApiError(error, 'POST /example-reaction');
  }
}

// Placeholder for scheduled task
async function performScheduledTask() {
  // Your task logic
  return { processed: 0 };
}
