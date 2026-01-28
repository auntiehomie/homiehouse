import { NextRequest, NextResponse } from "next/server";
import { fetchFeed } from '@/lib/neynar';
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

    // Validate inputs
    const limit = validateLimit(limitParam, 100);
    const fid = fidParam ? validateFid(fidParam).toString() : undefined;

    logger.info('Request params', { feedType, fid, channel, limit });

    // Build fetch parameters
    const fetchParams: any = { limit };

    if (channel) {
      // Channel feed
      fetchParams.feed_type = 'filter';
      fetchParams.filter_type = 'channel_id';
      fetchParams.channel_id = channel;
      if (fid) fetchParams.viewer_fid = fid;
    } else if (feedType === "following" && fid) {
      // Following feed
      fetchParams.feed_type = 'following';
      fetchParams.fid = fid;
      fetchParams.viewer_fid = fid;
    } else {
      // Default to global trending
      fetchParams.feed_type = 'filter';
      fetchParams.filter_type = 'global_trending';
      if (fid) fetchParams.viewer_fid = fid;
    }

    // Fetch feed using shared utility
    const data = await fetchFeed(fetchParams);

    const casts = data?.casts || [];
    logger.success(`Feed fetched successfully`, { count: casts.length });
    logger.end();

    return NextResponse.json({ data: casts });
  } catch (error: any) {
    logger.error('Failed to fetch feed', error);
    return handleApiError(error, 'GET /feed');
  }
}
