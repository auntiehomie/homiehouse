import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// ── Shop item definitions ────────────────────────────────────────────────────

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price_hh2: number;
  category: 'badge' | 'theme' | 'decoration' | 'slot' | 'boost';
  emoji: string;
  /** Theme definition — only for category='theme'. Applied to the full app theme system when purchased. */
  theme?: {
    bg: string;
    surface: string;
    text: string;
    accent: string;
    muted: string;
  };
  /** Decoration type — which profile element this decorates */
  decoration_type?: 'frame' | 'banner' | 'avatar-ring';
  /** Computed client-side by GET handler */
  owned?: boolean;
}

// Exported so the purchase route can reference prices + theme definitions
export const SHOP_ITEMS: ShopItem[] = [
  // ── Badges ────────────────────────────────────────────────────────────────
  {
    id: 'silver-badge',
    name: 'Silver Badge',
    description: 'A sleek silver profile badge. Your first milestone.',
    price_hh2: 200,
    category: 'badge',
    emoji: '🥈',
  },
  {
    id: 'gold-badge',
    name: 'Gold Badge',
    description: 'A shiny gold profile badge to flex on your friends.',
    price_hh2: 500,
    category: 'badge',
    emoji: '🥇',
  },
  {
    id: 'platinum-badge',
    name: 'Platinum Badge',
    description: 'Rarer than gold. Only the most dedicated learners.',
    price_hh2: 800,
    category: 'badge',
    emoji: '🔷',
  },
  {
    id: 'diamond-badge',
    name: 'Diamond Badge',
    description: 'The ultimate status symbol. Diamond-tier profile badge.',
    price_hh2: 1000,
    category: 'badge',
    emoji: '💎',
  },
  {
    id: 'ruby-badge',
    name: 'Ruby Badge',
    description: 'A deep crimson badge for the passionate.',
    price_hh2: 650,
    category: 'badge',
    emoji: '🔴',
  },
  {
    id: 'emerald-badge',
    name: 'Emerald Badge',
    description: 'For those who grow their knowledge every day.',
    price_hh2: 650,
    category: 'badge',
    emoji: '🟢',
  },
  {
    id: 'cosmic-badge',
    name: 'Cosmic Badge',
    description: 'Transcendent. For the truly devoted builder.',
    price_hh2: 1500,
    category: 'badge',
    emoji: '🌌',
  },
  {
    id: 'og-badge',
    name: 'OG Badge',
    description: 'You were here before it was cool. Limited edition.',
    price_hh2: 2000,
    category: 'badge',
    emoji: '👑',
  },

  // ── Cast Themes (functional — become selectable in Settings → Theme) ──────
  {
    id: 'purple-cast-theme',
    name: 'Purple Theme',
    description: 'A regal purple app theme.',
    price_hh2: 300,
    category: 'theme',
    emoji: '🟣',
    theme: { bg: '#1a0a2e', surface: '#2d1654', text: '#e0d5ff', accent: '#a78bfa', muted: 'rgba(224,213,255,0.55)' },
  },
  {
    id: 'green-cast-theme',
    name: 'Green Theme',
    description: 'A fresh green app theme.',
    price_hh2: 300,
    category: 'theme',
    emoji: '🟢',
    theme: { bg: '#0a1a0a', surface: '#142d14', text: '#d4ffd4', accent: '#4ade80', muted: 'rgba(212,255,212,0.55)' },
  },
  {
    id: 'midnight-theme',
    name: 'Midnight Theme',
    description: 'Deepest night, deepest focus.',
    price_hh2: 350,
    category: 'theme',
    emoji: '🌙',
    theme: { bg: '#080818', surface: '#101830', text: '#c8d6e5', accent: '#5b8def', muted: 'rgba(200,214,229,0.55)' },
  },
  {
    id: 'coral-theme',
    name: 'Coral Theme',
    description: 'Warm tropical vibes for your feed.',
    price_hh2: 350,
    category: 'theme',
    emoji: '🌺',
    theme: { bg: '#1a0d0d', surface: '#2d1515', text: '#ffd4d4', accent: '#f87171', muted: 'rgba(255,212,212,0.55)' },
  },
  {
    id: 'neon-theme',
    name: 'Neon Theme',
    description: 'Electric. Loud. Unmissable.',
    price_hh2: 400,
    category: 'theme',
    emoji: '💜',
    theme: { bg: '#0d0d1a', surface: '#1a1a2d', text: '#c4f0ff', accent: '#22d3ee', muted: 'rgba(196,240,255,0.55)' },
  },
  {
    id: 'arctic-theme',
    name: 'Arctic Theme',
    description: 'Clean and crisp like fresh snow.',
    price_hh2: 350,
    category: 'theme',
    emoji: '❄️',
    theme: { bg: '#0f1419', surface: '#1a2028', text: '#e8f4fd', accent: '#94c5fc', muted: 'rgba(232,244,253,0.55)' },
  },
  {
    id: 'lava-theme',
    name: 'Lava Theme',
    description: 'Molten. Intense. For the fire signs.',
    price_hh2: 400,
    category: 'theme',
    emoji: '🌋',
    theme: { bg: '#1a0a05', surface: '#2d1008', text: '#ffd8c8', accent: '#f97316', muted: 'rgba(255,216,200,0.55)' },
  },

  // ── Profile Decorations ───────────────────────────────────────────────────
  {
    id: 'rainbow-avatar-ring',
    name: 'Rainbow Avatar Ring',
    description: 'A shimmering rainbow ring around your profile picture.',
    price_hh2: 400,
    category: 'decoration',
    emoji: '🌈',
    decoration_type: 'avatar-ring',
  },
  {
    id: 'gold-avatar-ring',
    name: 'Gold Avatar Ring',
    description: 'A luxurious gold ring around your PFP.',
    price_hh2: 500,
    category: 'decoration',
    emoji: '✨',
    decoration_type: 'avatar-ring',
  },
  {
    id: 'gradient-banner',
    name: 'Gradient Banner',
    description: 'A smooth gradient banner for your profile header.',
    price_hh2: 350,
    category: 'decoration',
    emoji: '🎨',
    decoration_type: 'banner',
  },
  {
    id: 'stars-banner',
    name: 'Starry Banner',
    description: 'An animated starfield behind your profile.',
    price_hh2: 500,
    category: 'decoration',
    emoji: '⭐',
    decoration_type: 'banner',
  },
  {
    id: 'retro-frame',
    name: 'Retro Frame',
    description: 'An 8-bit pixel frame around your avatar.',
    price_hh2: 300,
    category: 'decoration',
    emoji: '🕹️',
    decoration_type: 'frame',
  },

  // ── Slots ──────────────────────────────────────────────────────────────────
  {
    id: 'extra-list-slot',
    name: 'Extra List Slot',
    description: 'Adds +1 to your curated list creation limit.',
    price_hh2: 2000,
    category: 'slot',
    emoji: '📋',
  },

  // ── Boosts ─────────────────────────────────────────────────────────────────
  {
    id: 'featured-learn',
    name: 'Featured Learner Spot',
    description: 'Get spotlighted on the /learn page for 7 days.',
    price_hh2: 3000,
    category: 'boost',
    emoji: '🌟',
  },
  {
    id: 'shoutout-boost',
    name: 'Shoutout Boost',
    description: 'Homethreshold bot gives you a personalized shoutout cast.',
    price_hh2: 1500,
    category: 'boost',
    emoji: '📣',
  },
];

// Build ITEM_PRICES + VALID_ITEM_IDS maps for the purchase route
export const ITEM_PRICES = SHOP_ITEMS.reduce((acc, item) => {
  acc[item.id] = item.price_hh2;
  return acc;
}, {} as Record<string, number>);

export const VALID_ITEM_IDS = new Set(Object.keys(ITEM_PRICES));

// Build shop-id-purchased themes map for theme integration
export const SHOP_THEME_DEFINITIONS = SHOP_ITEMS
  .filter(item => item.category === 'theme' && item.theme)
  .reduce((acc, item) => {
    acc[item.id] = item.theme!;
    return acc;
  }, {} as Record<string, ShopItem['theme']>);

// ── GET /api/hh2-shop — return available shop items, annotated with owned state ──

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userFid = Number(searchParams.get('fid'));
    let ownedSet: Set<string> = new Set();

    if (userFid && !isNaN(userFid) && userFid > 0) {
      try {
        const db = getDb();
        const purchases = await db.query(
          'SELECT item_id FROM hh2_purchases WHERE user_fid = $1',
          [userFid]
        );
        ownedSet = new Set(purchases.rows.map((r: any) => r.item_id));
      } catch { /* non-breaking if DB is not available */ }
    }

    const annotated = SHOP_ITEMS.map(item => ({
      ...item,
      owned: ownedSet.has(item.id),
    }));

    return NextResponse.json(
      { items: annotated },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    );
  } catch (err: any) {
    console.error('[hh2-shop] GET error:', err?.message);
    return NextResponse.json(
      { items: SHOP_ITEMS.map(it => ({ ...it, owned: false })) },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  }
}
