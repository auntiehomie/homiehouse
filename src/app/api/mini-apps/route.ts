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

// Fallback list shown when the node doesn't support the frame catalog endpoint
const FALLBACK_APPS = [
  { id: 'zora.co', name: 'Zora', description: 'Create, collect, and trade NFTs onchain', icon: '🎨', tags: ['Art', 'NFTs'], author: 'zora', url: 'https://zora.co', category: 'art-creativity' },
  { id: 'clanker.world', name: 'Clanker', description: 'Deploy and trade tokens instantly', icon: '💰', tags: ['Finance', 'Tokens'], author: 'clanker', url: 'https://clanker.world', category: 'finance' },
  { id: 'supercast.xyz', name: 'Supercast', description: 'Power user Farcaster client with advanced features', icon: '💬', tags: ['Social'], author: 'supercast', url: 'https://supercast.xyz', category: 'social' },
  { id: 'paragraph.xyz', name: 'Paragraph', description: 'Long-form writing and newsletters on Farcaster', icon: '📝', tags: ['Social', 'Writing'], author: 'paragraph', url: 'https://paragraph.xyz', category: 'social' },
  { id: 'news.kiwistand.com', name: 'Kiwi News', description: 'Tech news curated by the Farcaster community', icon: '📰', tags: ['News'], author: 'kiwi', url: 'https://news.kiwistand.com', category: 'news-media' },
  { id: 'launchcaster.xyz', name: 'Launchcaster', description: 'Discover and share new projects on Farcaster', icon: '🚀', tags: ['Productivity'], author: 'launchcaster', url: 'https://launchcaster.xyz', category: 'productivity' },
  { id: 'bountycaster.xyz', name: 'Bountycaster', description: 'Post and claim bounties in the Farcaster ecosystem', icon: '💸', tags: ['Finance', 'Jobs'], author: 'bountycaster', url: 'https://bountycaster.xyz', category: 'finance' },
  { id: 'interface.social', name: 'Interface', description: 'Explore NFTs and onchain art with your social graph', icon: '🖼️', tags: ['Art', 'NFTs'], author: 'interface', url: 'https://interface.social', category: 'art-creativity' },
  { id: 'events.xyz', name: 'Events', description: 'Discover and RSVP to events in the Farcaster community', icon: '📅', tags: ['Social', 'Events'], author: 'events', url: 'https://events.xyz', category: 'social' },
  { id: 'jam.systems', name: 'Jam', description: 'Social audio rooms powered by Farcaster', icon: '🎙️', tags: ['Entertainment', 'Audio'], author: 'jam', url: 'https://jam.systems', category: 'entertainment' },
  { id: 'pods.media', name: 'Pods', description: 'Podcasts and audio content for the Farcaster community', icon: '🎵', tags: ['Music', 'Podcasts'], author: 'pods', url: 'https://pods.media', category: 'music' },
  { id: 'alphacaster.xyz', name: 'Alphacaster', description: 'AI-powered insights and analytics for Farcaster', icon: '🤖', tags: ['AI', 'Analytics'], author: 'alphacaster', url: 'https://alphacaster.xyz', category: 'developer-tools' },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') || '50'), 100);
  const cursor = searchParams.get('cursor') || undefined;
  const timeWindow = (searchParams.get('time_window') || '7d') as '1h' | '6h' | '12h' | '24h' | '7d';
  const category = searchParams.get('category') || undefined;

  // Don't attempt pagination on a cursor for the fallback list
  if (cursor) {
    return NextResponse.json({ apps: [], cursor: null });
  }

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

    if (apps.length > 0) {
      return NextResponse.json({ apps, cursor: data?.next?.cursor || null });
    }
    // Frame catalog returned empty (common on self-hosted nodes) — use fallback
    return NextResponse.json({ apps: FALLBACK_APPS, cursor: null, fallback: true });
  } catch (e: any) {
    // "managed infrastructure" error or network failure — use fallback
    return NextResponse.json({ apps: FALLBACK_APPS, cursor: null, fallback: true });
  }
}
