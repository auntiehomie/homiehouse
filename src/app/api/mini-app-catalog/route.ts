import { NextResponse } from 'next/server';
import { createApiLogger } from '@/lib/logger';
import { rateLimit } from '@/lib/ratelimit';

const logger = createApiLogger('/mini-app-catalog');
const DISCOVERY_URL = 'https://client.warpcast.com/v1/top-frameapps?limit=100';

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
  const author = isRecord(value.author) ? value.author : {};
  const url = httpsUrl(value.homeUrl);
  if (!url) return null;

  let hostname: string;
  try { hostname = new URL(url).hostname; } catch { return null; }

  const name = text(value.name) ?? hostname;
  const id = text(value.domain) ?? url;
  const authorName = text(author.displayName) ?? (text(author.username) ? `@${text(author.username)}` : undefined);
  return {
    id,
    url,
    name,
    description: text(value.description) ?? (authorName ? `by ${authorName}` : ''),
    iconUrl: httpsUrl(value.iconUrl) ?? httpsUrl(value.imageUrl),
    heroImageUrl: httpsUrl(value.splashImageUrl) ?? httpsUrl(value.imageUrl),
    author: authorName,
    category: text(value.category) ?? text(value.primaryCategory),
  };
}

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { success } = rateLimit(`mini-app-catalog:${ip}`, 30, 60);
  if (!success) return NextResponse.json({ error: 'Too many catalog requests. Try again shortly.' }, { status: 429 });

  try {
    const response = await fetch(DISCOVERY_URL, {
      headers: { accept: 'application/json' },
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      logger.error('GET', new Error(`Mini App discovery feed returned ${response.status}`));
      return NextResponse.json({ error: 'The Mini App directory could not be loaded.' }, { status: 502 });
    }

    const payload: unknown = await response.json();
    const result = isRecord(payload) && isRecord(payload.result) ? payload.result : {};
    const frames = Array.isArray(result.frames) ? result.frames : [];
    const normalizedQuery = query.toLowerCase();
    const apps = frames
      .map(mapCatalogApp)
      .filter((app): app is NonNullable<typeof app> => app !== null)
      .filter(app => !normalizedQuery || `${app.name} ${app.description} ${app.author ?? ''} ${app.category ?? ''} ${app.url}`.toLowerCase().includes(normalizedQuery));
    return NextResponse.json({ apps }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } });
  } catch (error) {
    logger.error('GET', error);
    return NextResponse.json({ error: 'The Mini App directory could not be loaded.' }, { status: 502 });
  }
}
