import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { enforceRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { verifyPrivyAuth, verifyFarcasterSigner } from '@/lib/auth';

// GET /api/hh2-purchase?fid=123 — return owned item IDs
export async function GET(req: NextRequest) {
  const claims = await verifyPrivyAuth(req);
  const { searchParams } = new URL(req.url);
  const userFid = Number(searchParams.get('fid'));
  if (!userFid || isNaN(userFid) || userFid <= 0) {
    return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
  }

  // Verify the authenticated user owns this FID
  verifyFarcasterSigner(claims, userFid);

  try {
    const rows = await sql`SELECT item_id FROM hh2_purchases WHERE user_fid = ${userFid}`;
    const ownedItems = (rows as any[]).map((r: any) => r.item_id);
    return NextResponse.json({ ok: true, owned_items: ownedItems });
  } catch (err: any) {
    console.error('[hh2-purchase] GET error:', err?.message);
    return NextResponse.json({ ok: false, error: 'Failed to fetch purchases' }, { status: 500 });
  }
}

// ── Shop item prices (mirrors hh2-shop definitions) ──────────────────────────

const ITEM_PRICES: Record<string, number> = {
  'gold-badge': 500,
  'diamond-badge': 1000,
  'purple-cast-theme': 300,
  'green-cast-theme': 300,
  'extra-list-slot': 2000,
};

const VALID_ITEM_IDS = new Set(Object.keys(ITEM_PRICES));

// HH2 balance check helper — sums (completed_ids * 10) - (claimed) - (spent)
async function getUserHH2Balance(userFid: number): Promise<number> {
  const rows = await sql`
    SELECT completed_ids FROM learning_progress WHERE fid = ${userFid}
  `;
  const completedIds: string[] = rows[0]?.completed_ids ?? [];
  const earned = completedIds.length * 10;

  const claimedRows = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total FROM hh2_claims WHERE fid = ${userFid}
  `;
  const claimed = Number(claimedRows[0]?.total ?? 0);

  const spentRows = await sql`
    SELECT COUNT(*) AS count FROM hh2_purchases WHERE user_fid = ${userFid}
  `;
  const spentCount = Number(spentRows[0]?.count ?? 0);
  // Estimate spent = number of purchases * average price, but we need exact pricing.
  // Better approach: sum actual prices from item lookups.
  const purchaseRows = await sql`
    SELECT item_id FROM hh2_purchases WHERE user_fid = ${userFid}
  `;
  let spent = 0;
  for (const row of purchaseRows as any[]) {
    spent += ITEM_PRICES[row.item_id] ?? 0;
  }

  return earned - claimed - spent;
}

// POST /api/hh2-purchase — deduct HH2 and grant the item
export async function POST(req: NextRequest) {
  const logger = createApiLogger('/hh2-purchase');
  logger.start();

  try {
    // Verify auth token
    const claims = await verifyPrivyAuth(req);

    await enforceRateLimit({
      key: rateLimitKeyFromRequest(req),
      limit: 10,
      windowSeconds: 60,
      label: 'hh2-purchase',
    });

    const { fid, itemId } = await req.json();
    const userFid = Number(fid);

    if (!userFid || isNaN(userFid) || userFid <= 0) {
      return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
    }

    if (!itemId || !VALID_ITEM_IDS.has(itemId)) {
      return NextResponse.json(
        { ok: false, error: `Invalid item. Valid items: ${[...VALID_ITEM_IDS].join(', ')}` },
        { status: 400 }
      );
    }

    // Verify the authenticated user owns this FID
    verifyFarcasterSigner(claims, userFid);

    const price = ITEM_PRICES[itemId];

    // Check if user already owns this item (non-stackable items)
    const existing = await sql`
      SELECT id FROM hh2_purchases
      WHERE user_fid = ${userFid} AND item_id = ${itemId}
    `;
    if (existing.length > 0) {
      return NextResponse.json(
        { ok: false, error: 'You already own this item' },
        { status: 409 }
      );
    }

    // Check balance
    const balance = await getUserHH2Balance(userFid);
    logger.info('Balance check', { userFid, balance, price });

    if (balance < price) {
      return NextResponse.json(
        {
          ok: false,
          error: `Insufficient HH2 balance. You have ${balance} HH2, need ${price} HH2.`,
          balance,
          required: price,
        },
        { status: 402 }
      );
    }

    // Record the purchase
    await sql`
      INSERT INTO hh2_purchases (user_fid, item_id)
      VALUES (${userFid}, ${itemId})
    `;

    const newBalance = balance - price;

    logger.success('Purchase recorded', { userFid, itemId, price, newBalance });
    logger.end();

    return NextResponse.json({
      ok: true,
      item_id: itemId,
      price,
      balance_remaining: newBalance,
    });
  } catch (error: any) {
    logger.error('Purchase failed', error);
    return handleApiError(error, 'POST /hh2-purchase');
  }
}