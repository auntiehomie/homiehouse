import { NextRequest, NextResponse } from 'next/server';
import { createApiLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/ratelimit';
import { safeFetchPublicUrl } from '@/lib/safe-public-fetch';

export const maxDuration = 30;

const MAX_RESPONSE_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_CACHE_SIZE = 500;

// Type-safe global cache for URL preview data
type CacheEntry = { ts: number; data: Record<string, unknown> };
const globalCache = globalThis as typeof globalThis & {
  __urlPreviewCache?: Map<string, CacheEntry>;
};

interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  siteName?: string;
  type?: string;
}

/**
 * X.com / twitter.com blocks OG scraping. Use the fxtwitter public API instead.
 * Returns null if this isn't a Twitter/X URL.
 */
async function fetchXPreview(url: string): Promise<{ ok: boolean; metadata: OpenGraphData } | null> {
  let tweetId: string | null = null;
  try {
    const parsed = new URL(url);
    const isX = parsed.hostname === 'x.com' || parsed.hostname === 'twitter.com'
              || parsed.hostname === 'www.x.com' || parsed.hostname === 'www.twitter.com';
    if (!isX) return null;
    // URL shape: /USER/status/TWEET_ID  or  /USER/status/TWEET_ID?...
    const match = parsed.pathname.match(/\/status\/(\d+)/);
    if (!match) return null;
    tweetId = match[1];
  } catch {
    return null;
  }

  try {
    const res = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
      headers: { 'User-Agent': 'HomieHouseBot/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tweet = data?.tweet;
    if (!tweet) return null;

    const authorName = tweet.author?.name || tweet.author?.screen_name || '';
    const screenName = tweet.author?.screen_name || '';
    const text: string = tweet.text || '';
    const photo = tweet.media?.photos?.[0]?.url || tweet.media?.videos?.[0]?.thumbnail_url || '';

    return {
      ok: true,
      metadata: {
        title: authorName ? `${authorName} (@${screenName})` : `@${screenName}`,
        description: text,
        image: photo,
        siteName: 'X (Twitter)',
        url: tweet.url || url,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Extract Open Graph and meta tags from HTML.
 * Handles both attribute orderings: property=... content=... and content=... property=...
 */
function extractMetadata(html: string, url: string): OpenGraphData {
  const metadata: OpenGraphData = {};

  function getOgTag(property: string): string {
    // Try property before content
    const m1 = html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'));
    if (m1) return m1[1];
    // Try content before property
    const m2 = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'));
    return m2?.[1] || '';
  }

  function getMetaTag(name: string): string {
    const m1 = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'));
    if (m1) return m1[1];
    const m2 = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'));
    return m2?.[1] || '';
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

  metadata.title = getOgTag('og:title') || titleMatch?.[1] || '';
  metadata.description = getOgTag('og:description') || getMetaTag('description') || '';
  metadata.image = getOgTag('og:image') || '';
  metadata.siteName = getOgTag('og:site_name') || '';
  metadata.type = getOgTag('og:type') || '';
  metadata.url = getOgTag('og:url') || url;

  const decodeHtml = (str: string) => str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");

  if (metadata.title) metadata.title = decodeHtml(metadata.title);
  if (metadata.description) metadata.description = decodeHtml(metadata.description);

  return metadata;
}

/**
 * Extract first few paragraphs from article for summary
 */
function extractArticleText(html: string): string {
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  const paragraphs: string[] = [];
  const pMatches = cleaned.matchAll(/<p[^>]*>([^<]+(?:<[^\/p][^>]*>[^<]*<\/[^>]+>)*[^<]*)<\/p>/gi);

  for (const match of pMatches) {
    const text = match[1]
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length > 50 && !text.match(/cookie|privacy policy|terms of service/i)) {
      paragraphs.push(text);
      if (paragraphs.length >= 3) break;
    }
  }

  return paragraphs.join(' ').slice(0, 500);
}

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/url-preview');
  logger.start();

  try {
    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { success: rlOk } = rateLimit(`url-preview:${ip}`, 60, 3600);
    if (!rlOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    // Cache setup (persist across warm invocations)
    const CACHE_TTL = 60 * 60; // 1 hour
    if (!globalCache.__urlPreviewCache) {
      globalCache.__urlPreviewCache = new Map();
    }
    const cache = globalCache.__urlPreviewCache;
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    let validUrl: URL;
    try {
      validUrl = new URL(url);
      if (!['http:', 'https:'].includes(validUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }

    logger.info('Fetching URL preview', { url });

    // Return cached value when fresh
    const cached = cache.get(url);
    if (cached && (Date.now() - cached.ts) / 1000 < CACHE_TTL) {
      logger.info('Returning cached URL preview', { url });
      logger.end();
      return NextResponse.json(cached.data);
    }

    // X.com / Twitter — use fxtwitter API (they block OG scraping)
    const xPreview = await fetchXPreview(url);
    if (xPreview) {
      const responsePayload = { ...xPreview, articleText: null, isArticle: false };
      cache.set(url, { ts: Date.now(), data: responsePayload });
      logger.success('X preview via fxtwitter', { tweetId: url });
      logger.end();
      return NextResponse.json(responsePayload);
    }

    // Fetch the URL
    const response = await safeFetchPublicUrl(validUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HomieHouseBot/1.0; +https://homiehouse.lol)',
      },
      timeoutMs: 10000,
      maxRedirects: 3,
      maxBytes: MAX_RESPONSE_SIZE,
    });

    if (!response.ok) {
      logger.warn('Failed to fetch URL', { status: response.status });
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch URL', status: response.status },
        { status: 200 }
      );
    }

    // Read response with size limit
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      logger.warn('Response too large', { contentLength });
      return NextResponse.json(
        { ok: false, error: 'Response too large' },
        { status: 200 }
      );
    }

    let html = '';
    try {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_RESPONSE_SIZE) {
        logger.warn('Response body too large', { size: buffer.byteLength });
        return NextResponse.json(
          { ok: false, error: 'Response too large' },
          { status: 200 }
        );
      }
      html = new TextDecoder().decode(buffer);
    } catch (e) {
      logger.warn('Failed to read response body', { error: String(e) });
      return NextResponse.json(
        { ok: false, error: 'Failed to read response' },
        { status: 200 }
      );
    }

    const metadata = extractMetadata(html, url);
    if (!metadata.title && !metadata.description && !metadata.image) {
      logger.warn('No useful metadata extracted', { url });
    }

    const isArticle = metadata.type === 'article' ||
                     validUrl.hostname.includes('medium.com') ||
                     validUrl.hostname.includes('substack.com') ||
                     html.includes('article');

    let articleText = '';
    if (isArticle) {
      articleText = extractArticleText(html);
    }

    logger.success('URL preview generated', {
      hasTitle: !!metadata.title,
      hasDescription: !!metadata.description,
      hasImage: !!metadata.image,
      isArticle
    });
    const responsePayload = {
      ok: true,
      metadata,
      articleText: articleText || null,
      isArticle
    };

    // Store in cache (capped at MAX_CACHE_SIZE)
    try {
      if (cache.size >= MAX_CACHE_SIZE) {
        const firstKey = cache.keys().next().value;
        if (firstKey) cache.delete(firstKey);
      }
      cache.set(url, { ts: Date.now(), data: responsePayload });
    } catch {
      // ignore cache errors
    }

    logger.end();

    return NextResponse.json(responsePayload);

  } catch (error: any) {
    logger.error('Failed to generate URL preview', error);
    return handleApiError(error, 'POST /url-preview');
  }
}
