import { NextRequest, NextResponse } from 'next/server';

// ── Shop item definitions ────────────────────────────────────────────────────

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price_hh2: number;
  category: 'badge' | 'theme' | 'slot';
  emoji: string;
}

const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'gold-badge',
    name: 'Gold Badge',
    description: 'A shiny gold profile badge to flex on your friends.',
    price_hh2: 500,
    category: 'badge',
    emoji: '🥇',
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
    id: 'purple-cast-theme',
    name: 'Purple Cast Theme',
    description: 'A regal purple theme for your cast composer.',
    price_hh2: 300,
    category: 'theme',
    emoji: '🟣',
  },
  {
    id: 'green-cast-theme',
    name: 'Green Cast Theme',
    description: 'A fresh green theme for your cast composer.',
    price_hh2: 300,
    category: 'theme',
    emoji: '🟢',
  },
  {
    id: 'extra-list-slot',
    name: 'Extra List Slot',
    description: 'Adds +1 to your curated list creation limit.',
    price_hh2: 2000,
    category: 'slot',
    emoji: '📋',
  },
];

// GET /api/hh2-shop — return available shop items
export async function GET() {
  return NextResponse.json(
    { items: SHOP_ITEMS },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  );
}