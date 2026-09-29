import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import { SHOP_ITEMS } from '@/app/api/hh2-shop/route';

// GET /api/owned-themes?fid=123
// Returns themes the user has purchased from the HH2 shop, so the theme
// picker can show them as selectable options alongside free/premium themes.
export async function GET(req: NextRequest) {
  try {
    const authFid = await verifyFarcasterSignerAuth(req);
    const { searchParams } = new URL(req.url);
    const userFid = Number(searchParams.get('fid'));

    if (!userFid || isNaN(userFid) || userFid <= 0) {
      return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
    }

    if (authFid !== userFid) {
      return NextResponse.json(
        { ok: false, error: 'FID does not match authenticated user' },
        { status: 403 }
      );
    }

    const db = getDb();
    const purchases = await db.query(
      'SELECT item_id FROM hh2_purchases WHERE user_fid = $1',
      [userFid]
    );
    const ownedIds = new Set(purchases.rows.map((r: any) => r.item_id));

    // Find theme-type shop items that the user owns
    const ownedThemes = SHOP_ITEMS
      .filter(item => item.category === 'theme' && item.theme && ownedIds.has(item.id))
      .map(item => ({
        id: `shop:${item.id}`,
        name: item.name,
        description: item.description,
        emoji: item.emoji,
        source: 'shop' as const,
        preview: {
          bg: item.theme!.bg,
          surface: item.theme!.surface,
          text: item.theme!.text,
          accent: item.theme!.accent,
          muted: item.theme!.muted,
        },
      }));

    return NextResponse.json({ ok: true, themes: ownedThemes });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error('[owned-themes] GET error:', err?.message);
    return NextResponse.json({ ok: false, error: 'Failed to fetch owned themes' }, { status: 500 });
  }
}
