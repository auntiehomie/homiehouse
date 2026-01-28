import { NextRequest, NextResponse } from "next/server";
import { fetchUserChannels, fetchChannelList } from '@/lib/neynar';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid, validateLimit } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const logger = createApiLogger('/channels');
  logger.start();

  try {
    const { searchParams } = new URL(req.url);
    const fidParam = searchParams.get("fid");
    const limitParam = searchParams.get("limit");

    // Validate inputs
    const limit = validateLimit(limitParam, 100);
    const fid = fidParam ? validateFid(fidParam).toString() : null;

    logger.info('Request params', { fid, limit });

    // Fetch channels using shared utility
    const data = fid 
      ? await fetchUserChannels(fid, limit)
      : await fetchChannelList(limit);

    const channels = data?.channels || [];
    logger.success('Channels fetched', { count: channels.length });
    logger.end();

    return NextResponse.json({ ok: true, channels });
  } catch (error: any) {
    logger.error('Failed to fetch channels', error);
    return handleApiError(error, 'GET /channels');
  }
}
