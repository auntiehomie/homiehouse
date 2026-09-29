import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { SHOP_ITEMS } from '@/app/api/hh2-shop/route';

// GET /api/user-badges?fid=123
// Public endpoint — returns the badges (and decorations) a user owns from the
// HH2 shop. Badges are public profile data, so no signer auth is required.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userFid = Number(searchParams.get('fid'));

    if (!userFid || isNaN(userFid) || userFid <= 0) {
      return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
    }

    const db = getDb();
    const purchases = await db.query(
      'SELECT item_id FROM hh2_purchases WHERE user_fid = $1',
      [userFid]
    );
    const ownedIds = new Set(purchases.rows.map((r: any) => r.item_id));

    const badges = SHOP_ITEMS.filter(
      item => item.category === 'badge' && ownedIds.has(item.id)
    ).map(item => ({ id: item.id, name: item.name, emoji: item.emoji }));

    const decorations = SHOP_ITEMS.filter(
      item => item.category === 'decoration' && ownedIds.has(item.id)
    ).map(item => ({ id: item.id, name: item.name, emoji: item.emoji, decoration_type: item.decoration_type }));

    return NextResponse.json(
      { ok: true, badges, decorations },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } }
    );
  } catch (err: any) {
    console.error('[user-badges] GET error:', err?.message);
    return NextResponse.json({ ok: false, error: 'Failed to fetch badges' }, { status: 500 });
  }
}
