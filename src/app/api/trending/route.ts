import { NextRequest, NextResponse } from "next/server";
import { fetchTrendingFeed } from '@/lib/hypersnap';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateLimit, validateFid } from '@/lib/validation';
import { enforceRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';
import { fetchSponsoredCast } from '@/lib/sponsored';

export async function GET(req: NextRequest) {
  const logger = createApiLogger('/trending');
  logger.start();

  try {
    // Now a guest-accessible entry point (feed/page.tsx shows this to signed-out
    // visitors) — response is already CDN-cached (see Cache-Control below), this
    // is just defense-in-depth against direct API abuse.
    await enforceRateLimit({ key: rateLimitKeyFromRequest(req), limit: 60, windowSeconds: 60, label: 'trending' });

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const timeWindow = searchParams.get("time_window") || "24h";
    const viewerFidParam = searchParams.get("viewer_fid");
    const channelId = searchParams.get("channel_id");

    // Validate inputs
    const limit = validateLimit(limitParam, 50);
    const viewerFid = viewerFidParam ? validateFid(viewerFidParam).toString() : undefined;

    logger.info('Request params', { limit, timeWindow, viewerFid, channelId });

    // Trending and sponsorship are independent reads, so start them together.
    // viewer_fid is intentionally not forwarded: the current ranking is shared,
    // not personalized, and excluding it keeps every user on the same CDN key.
    const [data, sponsored] = await Promise.all([
      fetchTrendingFeed({
        limit,
        time_window: timeWindow,
        channel_id: channelId || undefined,
      }),
      fetchSponsoredCast().catch((sponsorErr) => {
        // Non-critical — don't fail the whole trending response
        logger.warn?.('Failed to fetch sponsored cast', sponsorErr);
        return null;
      }),
    ]);

    const casts = data?.casts || [];

    logger.success('Trending casts fetched', { count: casts.length, sponsored: !!sponsored });
    logger.end();

    return NextResponse.json(
      { data: casts, sponsored },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
    );
  } catch (error: any) {
    logger.error('Failed to fetch trending', error);
    return handleApiError(error, 'GET /trending');
  }
}
