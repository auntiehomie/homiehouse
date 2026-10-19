import { NextRequest, NextResponse } from "next/server";
import { fetchFeed, fetchChannelFeed } from '@/lib/hypersnap';
import { rankCommunityPage } from '@/lib/community-feed';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid, validateLimit } from '@/lib/validation';
import { enforceRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function castUrl(cast: any): string {
  return cast?.hash ? `${BASE_URL}/cast/${encodeURIComponent(cast.hash)}` : BASE_URL;
}

function castTitle(cast: any): string {
  const author = cast?.author?.username || cast?.author?.display_name || 'Farcaster user';
  return `@${author}: ${(cast?.text || 'New cast').slice(0, 100)}`;
}

function toRss(casts: any[]): string {
  const items = casts.map((cast) => {
    const url = castUrl(cast);
    const published = cast?.timestamp ? new Date(cast.timestamp).toUTCString() : new Date().toUTCString();
    return `    <item>\n      <title>${escapeXml(castTitle(cast))}</title>\n      <link>${escapeXml(url)}</link>\n      <guid isPermaLink="true">${escapeXml(url)}</guid>\n      <description>${escapeXml(cast?.text || '')}</description>\n      <pubDate>${escapeXml(published)}</pubDate>\n    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>HomieHouse Feed</title>\n    <link>${escapeXml(BASE_URL)}/feed</link>\n    <description>Curated casts and conversations from the open social web.</description>\n    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n${items}\n  </channel>\n</rss>`;
}

export async function GET(req: NextRequest) {
  const logger = createApiLogger('/feed');
  logger.start();

  try {
    await enforceRateLimit({ key: rateLimitKeyFromRequest(req), limit: 60, windowSeconds: 60, label: 'feed', allowInMemoryPreview: true });
    const { searchParams } = new URL(req.url);
    const feedType = searchParams.get("feed_type") || "following";
    const fidParam = searchParams.get("fid");
    const channel = searchParams.get("channel");
    const limitParam = searchParams.get("limit");
    const cursor = searchParams.get("cursor");
    const limit = validateLimit(limitParam, 100);
    const fid = fidParam ? validateFid(fidParam).toString() : undefined;
    if (feedType === 'following' && !fid && !channel) {
      return NextResponse.json({ error: 'Sign in to load your Following feed.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    let data: any;

    if (channel) {
      data = await fetchChannelFeed(channel, { limit, cursor: cursor || undefined, viewerFid: fid ? Number(fid) : undefined });
    } else {
      const fetchParams: any = { limit };
      if (cursor) fetchParams.cursor = cursor;
      if (feedType === "following" && fid) {
        fetchParams.feed_type = 'following'; fetchParams.fid = fid; fetchParams.viewer_fid = fid;
        data = await fetchFeed(fetchParams);

      } else {
        fetchParams.feed_type = 'filter'; fetchParams.filter_type = 'global_trending';
        if (fid) fetchParams.viewer_fid = fid;
        data = await fetchFeed(fetchParams);
      }
    }

    const isCommunity = feedType === 'community' && !channel;
    const casts: any[] = isCommunity ? await rankCommunityPage(data?.casts || []) : data?.casts || [];
    // Node casts remain visible regardless of third-party reputation scores.
    // User-selected mute/hide preferences are applied by the client.

    const wantsRss = searchParams.get('format') === 'rss' || req.headers.get('accept')?.includes('application/rss+xml');
    if (wantsRss) {
      return new NextResponse(toRss(casts), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
    }

    const rawCursor = data?.next?.cursor || null;
    const cursor_out = rawCursor === '5b6e756c6c2c6e756c6c5d' ? null : rawCursor;
    return NextResponse.json({ data: casts, cursor: cursor_out, meta: { source: 'hypersnap', feedType: channel ? 'channel' : feedType, checkedAt: new Date().toISOString(), automatedSpamFiltering: false, ...(isCommunity ? { ranking: { version: 'community-v1', scope: 'node-page', candidateSource: 'hypersnap-trending', history: 'recent-50-cast-sample', authenticityVerified: false } } : {}) } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    logger.error('Failed to fetch feed', error);
    return handleApiError(error, 'GET /feed');
  }
}
