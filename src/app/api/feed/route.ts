import { NextRequest, NextResponse } from "next/server";
import { fetchFeed, fetchChannelFeed } from '@/lib/hypersnap';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid, validateLimit } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const logger = createApiLogger('/feed');
  logger.start();

  try {
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
      } else {
        fetchParams.feed_type = 'filter';
        fetchParams.filter_type = 'global_trending';
        if (fid) fetchParams.viewer_fid = fid;
      }

      data = await fetchFeed(fetchParams);
    }

    const casts = data?.casts || [];
    logger.success(`Feed fetched successfully`, { count: casts.length });
    logger.end();

    return NextResponse.json({ data: casts, cursor: data?.next?.cursor || null });
  } catch (error: any) {
    logger.error('Failed to fetch feed', error);
    return handleApiError(error, 'GET /feed');
  }
}
