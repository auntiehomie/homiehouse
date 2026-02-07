import { NextRequest, NextResponse } from 'next/server';
import { createApiLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors';

export const maxDuration = 30;

interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  siteName?: string;
  type?: string;
}

/**
 * Extract Open Graph and meta tags from HTML
 */
function extractMetadata(html: string, url: string): OpenGraphData {
  const metadata: OpenGraphData = {};

  // Extract OG tags
  const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  const ogSiteMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
  const ogTypeMatch = html.match(/<meta\s+property=["']og:type["']\s+content=["']([^"']+)["']/i);

  // Extract standard meta tags as fallback
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);

  metadata.title = ogTitleMatch?.[1] || titleMatch?.[1] || '';
  metadata.description = ogDescMatch?.[1] || descMatch?.[1] || '';
  metadata.image = ogImageMatch?.[1] || '';
  metadata.siteName = ogSiteMatch?.[1] || '';
  metadata.type = ogTypeMatch?.[1] || '';
  metadata.url = url;

  // Decode HTML entities
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
  // Remove script and style tags
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Extract paragraphs
  const paragraphs: string[] = [];
  const pMatches = cleaned.matchAll(/<p[^>]*>([^<]+(?:<[^\/p][^>]*>[^<]*<\/[^>]+>)*[^<]*)<\/p>/gi);
  
  for (const match of pMatches) {
    const text = match[1]
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ')    // Normalize whitespace
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
    // Simple in-memory cache with TTL (serverless functions are ephemeral but this
    // helps for warm instances during preview/deploys). Cache key is URL.
    const CACHE_TTL = 60 * 60; // 1 hour
    type CacheEntry = { ts: number; data: any };
    // @ts-ignore global cache (persist across invocations when warmed)
    globalThis.__urlPreviewCache = (globalThis.__urlPreviewCache || new Map()) as Map<string, CacheEntry>;
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
    const cache = (globalThis.__urlPreviewCache as Map<string, CacheEntry>);
    const cached = cache.get(url);
    if (cached && (Date.now() - cached.ts) / 1000 < CACHE_TTL) {
      logger.info('Returning cached URL preview', { url });
      logger.end();
      return NextResponse.json(cached.data);
    }

    // Fetch the URL with a user agent
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HomieHouseBot/1.0; +https://homiehouse.lol)',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      logger.warn('Failed to fetch URL', { status: response.status });
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch URL', status: response.status },
        { status: 200 }
      );
    }

    let html = '';
    try {
      html = await response.text();
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
    
    // Check if it's an article type
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

    // Store in cache
    try {
      cache.set(url, { ts: Date.now(), data: responsePayload });
    } catch (e) {
      // ignore cache errors
    }

    logger.end();

    return NextResponse.json(responsePayload);

  } catch (error: any) {
    logger.error('Failed to generate URL preview', error);
    return handleApiError(error, 'POST /url-preview');
  }
}
