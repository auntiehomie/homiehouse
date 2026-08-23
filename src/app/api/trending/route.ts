import { NextRequest, NextResponse } from "next/server";
import { fetchTrendingFeed } from '@/lib/hypersnap';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateLimit, validateFid } from '@/lib/validation';
import { enforceRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';
import { sql } from '@/lib/db';

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

    // Fetch trending feed using shared utility
    const data = await fetchTrendingFeed({
      limit,
      time_window: timeWindow,
      viewer_fid: viewerFid,
      channel_id: channelId || undefined,
    });

    const casts = data?.casts || [];

    // Optionally inject a sponsored cast at position 3 (index 2)
    let sponsored = null;
    try {
      const sponsoredRows = await sql`
        SELECT id, sponsor_fid, cast_hash, impression_count, click_count, budget_remaining
        FROM sponsored_casts
        WHERE budget_remaining > 0
        ORDER BY budget_remaining DESC, created_at DESC
        LIMIT 1
      `;
      if (sponsoredRows.length > 0) {
        sponsored = sponsoredRows[0];
        // Increment impression count and decrement budget
        await sql`
          UPDATE sponsored_casts
          SET impression_count = impression_count + 1, budget_remaining = budget_remaining - 1
          WHERE id = ${(sponsored as any).id}
        `;
      }
    } catch (sponsorErr) {
      // Non-critical — don't fail the whole trending response
      logger.warn?.('Failed to fetch sponsored cast', sponsorErr);
    }

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
