import { NextRequest, NextResponse } from "next/server";
import { fetchUserChannels, fetchChannelList } from '@/lib/hypersnap';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid, validateLimit } from '@/lib/validation';

// Cache Warpcast all-channels for 1 hour (server-wide)
const warpcastCache = globalThis as typeof globalThis & {
  __warpcastChannels?: { ts: number; map: Map<string, string> };
};

async function getWarpcastImageMap(): Promise<Map<string, string>> {
  const TTL = 60 * 60 * 1000; // 1 hour
  const cached = warpcastCache.__warpcastChannels;
  if (cached && Date.now() - cached.ts < TTL) return cached.map;

  const map = new Map<string, string>();
  try {
    const res = await fetch('https://api.warpcast.com/v2/all-channels', {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const list: any[] = data?.result?.channels || data?.channels || [];
      for (const ch of list) {
        const id = ch.id || ch.channelId;
        const img = ch.imageUrl || ch.image_url || ch.image || '';
        if (id && img) map.set(id, img);
      }
    }
  } catch {}

  warpcastCache.__warpcastChannels = { ts: Date.now(), map };
  return map;
}

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

    const [data, imageMap] = await Promise.all([
      fid ? fetchUserChannels(fid, limit) : fetchChannelList(limit),
      getWarpcastImageMap(),
    ]);

    const raw = data?.channels || [];
    const channels = raw.map((ch: any) => {
      const id = ch.id || ch.name || '';
      // Prefer Snapchain image if present, fall back to Warpcast
      const image_url =
        ch.image_url || ch.imageUrl || ch.image || ch.icon_url ||
        imageMap.get(id) || null;
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
