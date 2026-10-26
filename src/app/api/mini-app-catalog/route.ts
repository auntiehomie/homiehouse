import { NextResponse } from 'next/server';
import { createApiLogger } from '@/lib/logger';
import { rateLimit } from '@/lib/ratelimit';

const logger = createApiLogger('/mini-app-catalog');
const CATALOG_URL = 'https://api.neynar.com/v2/farcaster/frame/catalog/';
const SEARCH_URL = 'https://api.neynar.com/v2/farcaster/frame/search/';

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function httpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function mapCatalogApp(value: unknown) {
  if (!isRecord(value)) return null;
  const manifest = isRecord(value.manifest) ? value.manifest : {};
  const miniapp = isRecord(manifest.miniapp) ? manifest.miniapp : {};
  const frame = isRecord(manifest.frame) ? manifest.frame : {};
  const author = isRecord(value.author) ? value.author : {};
  const url = httpsUrl(miniapp.home_url) ?? httpsUrl(frame.home_url) ?? httpsUrl(value.frames_url);
  if (!url) return null;

  let hostname: string;
  try { hostname = new URL(url).hostname; } catch { return null; }

  const name = text(miniapp.name) ?? text(frame.name) ?? text(value.title) ?? hostname;
  const id = text(value.frames_url) ?? url;
  return {
    id,
    url,
    name,
    description: text(miniapp.description) ?? text(frame.description) ?? text(miniapp.tagline) ?? text(frame.tagline) ?? '',
    iconUrl: httpsUrl(miniapp.icon_url) ?? httpsUrl(frame.icon_url) ?? httpsUrl(value.image),
    heroImageUrl: httpsUrl(miniapp.hero_image_url) ?? httpsUrl(frame.hero_image_url) ?? httpsUrl(miniapp.image_url) ?? httpsUrl(frame.image_url),
    author: text(author.display_name) ?? (text(author.username) ? `@${text(author.username)}` : undefined),
    category: text(miniapp.primary_category) ?? text(frame.primary_category),
  };
}

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (query.length > 32) {
    return NextResponse.json({ error: 'Search terms must be 32 characters or fewer.' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { success } = rateLimit(`mini-app-catalog:${ip}`, 30, 60);
  if (!success) return NextResponse.json({ error: 'Too many catalog requests. Try again shortly.' }, { status: 429 });

  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Mini App discovery is not configured yet.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const providerUrl = query
      ? `${SEARCH_URL}?${new URLSearchParams({ q: query, limit: '50' })}`
      : `${CATALOG_URL}?limit=100&time_window=7d`;
    const response = await fetch(providerUrl, {
      headers: { accept: 'application/json', 'x-api-key': apiKey },
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      logger.error('GET', new Error(`Mini App catalog provider returned ${response.status}`));
      return NextResponse.json({ error: 'The Mini App directory could not be loaded.' }, { status: 502 });
    }

    const payload: unknown = await response.json();
    const frames = isRecord(payload) && Array.isArray(payload.frames) ? payload.frames : [];
    const apps = frames.map(mapCatalogApp).filter((app): app is NonNullable<typeof app> => app !== null);
    const cacheSeconds = query ? 60 : 300;
    return NextResponse.json({ apps }, { headers: { 'Cache-Control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=900` } });
  } catch (error) {
    logger.error('GET', error);
    return NextResponse.json({ error: 'The Mini App directory could not be loaded.' }, { status: 502 });
  }
}
