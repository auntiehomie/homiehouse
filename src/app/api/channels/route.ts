import { NextRequest, NextResponse } from "next/server";
import { fetchUserChannels, fetchChannelList } from '@/lib/hypersnap';
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

    const limit = validateLimit(limitParam, 100);
    const fid = fidParam ? validateFid(fidParam) : null;

    logger.info('Request params', { fid, limit });

    const data = fid ? await fetchUserChannels(fid, limit) : await fetchChannelList(limit);

    const raw = data?.channels || [];
    const channels = raw.map((ch: any) => {
      const image_url = ch.image_url || ch.imageUrl || ch.image || ch.icon_url || null;
      return { ...ch, image_url };
    });

    logger.success('Channels fetched', { count: channels.length });
    logger.end();

    return NextResponse.json({ ok: true, channels }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  } catch (error: any) {
    logger.error('Failed to fetch channels', error);
    return handleApiError(error, 'GET /channels');
  }
}
