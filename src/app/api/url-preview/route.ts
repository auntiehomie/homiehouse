import { NextRequest, NextResponse } from 'next/server';
import { createApiLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/ratelimit';
import dns from 'dns/promises';

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
 * Check if an IP address belongs to a private/internal range (SSRF protection).
 */
function isPrivateIP(ip: string): boolean {
  // IPv6 loopback
  if (ip === '::1' || ip === '::') return true;

  // IPv6 private (fc00::/7)
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;

  // IPv4
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;

  const [a, b] = parts;
  if (a === 10) return true;                         // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
  if (a === 192 && b === 168) return true;            // 192.168.0.0/16
  if (a === 127) return true;                         // 127.0.0.0/8
  if (a === 169 && b === 254) return true;            // 169.254.0.0/16
  if (a === 0) return true;                           // 0.0.0.0/8

  return false;
}

/**
 * Resolve hostname and verify it doesn't point to a private IP.
 */
async function resolveAndCheckHost(hostname: string): Promise<void> {
  // Check if hostname is already an IP literal
  if (isPrivateIP(hostname)) {
    throw new Error('URL resolves to a private/internal IP address');
  }

  try {
    const addresses = await dns.resolve4(hostname);
    for (const addr of addresses) {
      if (isPrivateIP(addr)) {
        throw new Error('URL resolves to a private/internal IP address');
      }
    }
  } catch (err: any) {
    if (err.message?.includes('private')) throw err;
    // Also try IPv6
    try {
      const addresses6 = await dns.resolve6(hostname);
      for (const addr of addresses6) {
        if (isPrivateIP(addr)) {
          throw new Error('URL resolves to a private/internal IP address');
        }
      }
    } catch {
      // If DNS fails entirely, fetch will also fail
    }
  }
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
 * Extract Open Graph and meta tags from HTML
 */
function extractMetadata(html: string, url: string): OpenGraphData {
  const metadata: OpenGraphData = {};

  const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  const ogSiteMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
  const ogTypeMatch = html.match(/<meta\s+property=["']og:type["']\s+content=["']([^"']+)["']/i);

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);

  metadata.title = ogTitleMatch?.[1] || titleMatch?.[1] || '';
  metadata.description = ogDescMatch?.[1] || descMatch?.[1] || '';
  metadata.image = ogImageMatch?.[1] || '';
  metadata.siteName = ogSiteMatch?.[1] || '';
  metadata.type = ogTypeMatch?.[1] || '';
  metadata.url = url;

  const decodeHtml = (str: string) => {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'");
  };

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

    // SSRF protection: resolve hostname and block private IPs
    try {
      await resolveAndCheckHost(validUrl.hostname);
    } catch {
      return NextResponse.json(
        { error: 'URL not allowed' },
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
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HomieHouseBot/1.0; +https://homiehouse.lol)',
      },
      signal: AbortSignal.timeout(10000),
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
