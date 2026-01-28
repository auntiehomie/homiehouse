import { NextRequest, NextResponse } from "next/server";
import { fetchTrendingFeed } from '@/lib/neynar';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateLimit, validateFid } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const logger = createApiLogger('/trending');
  logger.start();

  try {
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
    logger.success('Trending casts fetched', { count: casts.length });
    logger.end();

    return NextResponse.json({ data: casts });
  } catch (error: any) {
    logger.error('Failed to fetch trending', error);
    return handleApiError(error, 'GET /trending');
  }
}
