import { NextRequest, NextResponse } from "next/server";
import { fetchFeed, fetchChannelFeed } from '@/lib/hypersnap';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid, validateLimit } from '@/lib/validation';
import { getOpenRankScores, isSpamAccount } from '@/lib/openrank';
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
    await enforceRateLimit({ key: rateLimitKeyFromRequest(req), limit: 60, windowSeconds: 60, label: 'feed' });
    const { searchParams } = new URL(req.url);
    const feedType = searchParams.get("feed_type") || "following";
    const fidParam = searchParams.get("fid");
    const channel = searchParams.get("channel");
    const limitParam = searchParams.get("limit");
    const cursor = searchParams.get("cursor");
    const limit = validateLimit(limitParam, 100);
    const fid = fidParam ? validateFid(fidParam).toString() : undefined;
    let data: any;

    if (channel) {
      data = await fetchChannelFeed(channel, { limit, cursor: cursor || undefined, viewerFid: fid ? Number(fid) : undefined });
    } else {
      const fetchParams: any = { limit };
      if (cursor) fetchParams.cursor = cursor;
      if (feedType === "following" && fid) {
        fetchParams.feed_type = 'following'; fetchParams.fid = fid; fetchParams.viewer_fid = fid;
        data = await fetchFeed(fetchParams);
        if (!data?.casts?.length) {
          const fallback: any = { feed_type: 'filter', filter_type: 'global_trending', limit };
          if (cursor) fallback.cursor = cursor;
          if (fid) fallback.viewer_fid = fid;
          const fallbackData = await fetchFeed(fallback);
          if (fallbackData?.casts?.length) data = fallbackData;
        }
      } else {
        fetchParams.feed_type = 'filter'; fetchParams.filter_type = 'global_trending';
        if (fid) fetchParams.viewer_fid = fid;
        data = await fetchFeed(fetchParams);
      }
    }

    let casts: any[] = data?.casts || [];
    if (casts.length > 0) {
      try {
        const currentFid = fid ? Number(fid) : 0;
        const authorFids = [...new Set(casts.map((c: any) => c.author?.fid).filter((f: any) => f && f !== currentFid))] as number[];
        if (authorFids.length > 0) {
          const scores = await getOpenRankScores(authorFids);
          casts = casts.filter((cast: any) => {
            const authorFid = cast.author?.fid;
            return !authorFid || authorFid === currentFid || !isSpamAccount(authorFid, scores, cast.author);
          });
        }
      } catch { /* Fail open: feed availability wins over enrichment. */ }
    }

    const wantsRss = searchParams.get('format') === 'rss' || req.headers.get('accept')?.includes('application/rss+xml');
    if (wantsRss) {
      return new NextResponse(toRss(casts), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
    }

    const rawCursor = data?.next?.cursor || null;
    const cursor_out = rawCursor === '5b6e756c6c2c6e756c6c5d' ? null : rawCursor;
    const isPersonalFeed = feedType === 'following' && !!fid;
    return NextResponse.json({ data: casts, cursor: cursor_out }, { headers: { 'Cache-Control': isPersonalFeed ? 'private, max-age=20, stale-while-revalidate=40' : 'public, s-maxage=30, stale-while-revalidate=60' } });
  } catch (error: any) {
    logger.error('Failed to fetch feed', error);
    return handleApiError(error, 'GET /feed');
  }
}
