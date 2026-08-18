import { NextRequest, NextResponse } from "next/server";
import { fetchFeed, fetchChannelFeed } from '@/lib/hypersnap';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid, validateLimit } from '@/lib/validation';
import { getOpenRankScores, isSpamAccount } from '@/lib/openrank';
import { enforceRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';

export async function GET(req: NextRequest) {
  const logger = createApiLogger('/feed');
  logger.start();

  try {
    // Now a guest-accessible entry point (feed/page.tsx shows the Global feed to
    // signed-out visitors) — response is already CDN-cached for non-personal
    // feeds (see Cache-Control below), this is just defense-in-depth.
    await enforceRateLimit({ key: rateLimitKeyFromRequest(req), limit: 60, windowSeconds: 60, label: 'feed' });

    const { searchParams } = new URL(req.url);
    const feedType = searchParams.get("feed_type") || "following";
    const fidParam = searchParams.get("fid");
    const channel = searchParams.get("channel");
    const limitParam = searchParams.get("limit");
    const cursor = searchParams.get("cursor");

    // Validate inputs
    const limit = validateLimit(limitParam, 100);
    const fid = fidParam ? validateFid(fidParam).toString() : undefined;

    logger.info('Request params', { feedType, fid, channel, limit });

    let data: any;

    if (channel) {
      // Use dedicated channel feed function with fallback logic
      data = await fetchChannelFeed(channel, {
        limit,
        cursor: cursor || undefined,
        viewerFid: fid ? Number(fid) : undefined,
      });
    } else {
      // Build fetch parameters for following / trending
      const fetchParams: any = { limit };
      if (cursor) fetchParams.cursor = cursor;

      if (feedType === "following" && fid) {
        fetchParams.feed_type = 'following';
        fetchParams.fid = fid;
        fetchParams.viewer_fid = fid;
        data = await fetchFeed(fetchParams);
        // If following feed is empty, fall back to global trending so the user
        // always sees something. Skip Hypersnap here since it may already be slow —
        // call fetchFeed directly with the trending params.
        if (!data?.casts?.length) {
          const trendingParams: any = { feed_type: 'filter', filter_type: 'global_trending', limit };
          if (cursor) trendingParams.cursor = cursor;
          if (fid) trendingParams.viewer_fid = fid;
          const fallback = await fetchFeed(trendingParams);
          if (fallback?.casts?.length) data = fallback;
        }
      } else {
        fetchParams.feed_type = 'filter';
        fetchParams.filter_type = 'global_trending';
        if (fid) fetchParams.viewer_fid = fid;
        data = await fetchFeed(fetchParams);
      }
    }

    let casts: any[] = data?.casts || [];
    logger.success(`Feed fetched successfully`, { count: casts.length });

    // Filter spam accounts via OpenRank (free, no API key).
    // Runs after the feed fetch; Redis caching keeps added latency minimal.
    if (casts.length > 0) {
      try {
        const currentFid = fid ? Number(fid) : 0;
        const authorFids = [...new Set(
          casts.map((c: any) => c.author?.fid).filter((f: any) => f && f !== currentFid)
        )] as number[];

        if (authorFids.length > 0) {
          const scores = await getOpenRankScores(authorFids);
          const before = casts.length;
          casts = casts.filter((cast: any) => {
            const authorFid = cast.author?.fid;
            if (!authorFid || authorFid === currentFid) return true;
            return !isSpamAccount(authorFid, scores, cast.author);
          });
          const filtered = before - casts.length;
          if (filtered > 0) logger.info(`Spam filtered ${filtered} casts`);
        }
      } catch {
        // Fail open — never let spam filtering break the feed
      }
    }

    logger.end();

    // The Snapchain node returns hex([null,null]) as a sentinel meaning no more results.
    // Treat it as null so the client stops paginating.
    const rawCursor = data?.next?.cursor || null;
    const cursor_out = rawCursor === '5b6e756c6c2c6e756c6c5d' ? null : rawCursor;

    const isPersonalFeed = feedType === 'following' && !!fid;
    const cc = isPersonalFeed
      ? 'private, max-age=20, stale-while-revalidate=40'
      : 'public, s-maxage=30, stale-while-revalidate=60';
    return NextResponse.json({ data: casts, cursor: cursor_out }, { headers: { 'Cache-Control': cc } });
  } catch (error: any) {
    logger.error('Failed to fetch feed', error);
    return handleApiError(error, 'GET /feed');
  }
}
