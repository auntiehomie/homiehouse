import { NextRequest, NextResponse } from 'next/server';
import { fetchMiniAppCatalog } from '@/lib/hypersnap';

function categoryIcon(cat: string): string {
  const map: Record<string, string> = {
    games: '🎮', social: '💬', finance: '💰', utility: '🔧',
    productivity: '⚡', 'health-fitness': '💪', 'news-media': '📰',
    music: '🎵', shopping: '🛍️', education: '📚',
    'developer-tools': '🛠️', entertainment: '🎬', 'art-creativity': '🎨',
  };
  return map[cat] || '🔗';
}

function formatCategory(cat: string): string {
  return cat.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function mapFrame(frame: any) {
  const mf = frame.manifest?.frame || {};
  const name = mf.name || frame.title || 'Unknown';
  const description = mf.tagline || mf.description || '';
  const iconUrl: string = mf.iconUrl || mf.icon_url || '';
  const imageUrl: string = mf.imageUrl || mf.image_url || mf.heroImage || '';
  const homeUrl: string = frame.frames_url || mf.homeUrl || mf.home_url || '';
  const cat: string = mf.primaryCategory || mf.primary_category || '';
  const extraTags: string[] = Array.isArray(mf.tags) ? mf.tags.slice(0, 1) : [];
  const tags: string[] = [
    ...(cat ? [formatCategory(cat)] : []),
    ...extraTags,
  ].slice(0, 2);
  const author: string = frame.author?.username || '';

  return {
    id: homeUrl || name,
    name,
    description,
    icon: categoryIcon(cat),
    iconUrl,
    imageUrl,
    tags,
    author,
    url: homeUrl,
    category: cat,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') || '50'), 100);
  const cursor = searchParams.get('cursor') || undefined;
  const timeWindow = (searchParams.get('time_window') || '7d') as '1h' | '6h' | '12h' | '24h' | '7d';
  const category = searchParams.get('category') || undefined;

  try {
    const data = await fetchMiniAppCatalog({
      limit,
      cursor,
      timeWindow,
      categories: category ? [category] : undefined,
    });

    const apps = (data?.frames || [])
      .map(mapFrame)
      .filter((a: any) => a.url && a.name !== 'Unknown');

    return NextResponse.json({ apps, cursor: data?.next?.cursor || null });
  } catch (e: any) {
    return NextResponse.json({ apps: [], cursor: null, error: e?.message }, { status: 200 });
  }
}
