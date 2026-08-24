import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { enforceRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { verifyFarcasterSignerAuth, verifyFarcasterSigner } from '@/lib/auth';

// GET /api/hh2-purchase?fid=123 — return owned item IDs
export async function GET(req: NextRequest) {
  const authFid = await verifyFarcasterSignerAuth(req);
  const { searchParams } = new URL(req.url);
  const userFid = Number(searchParams.get('fid'));
  if (!userFid || isNaN(userFid) || userFid <= 0) {
    return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
  }

  // Verify the authenticated FID matches
  if (authFid !== userFid) {
    return NextResponse.json(
      { ok: false, error: 'FID does not match authenticated user' },
      { status: 403 }
    );
  }

  try {
    const db = getDb();
    const [purchases, progress, claims] = await Promise.all([
      db.query('SELECT item_id, purchased_at FROM hh2_purchases WHERE user_fid = $1 ORDER BY purchased_at ASC', [userFid]),
      db.query('SELECT completed_ids FROM learning_progress WHERE fid = $1', [userFid]),
      db.query('SELECT COALESCE(SUM(amount), 0) AS total FROM hh2_claims WHERE fid = $1', [userFid]),
    ]);
    const rows = purchases.rows;
    const ownedItems = (rows as any[]).map((r: any) => r.item_id);
    const earned = (progress.rows[0]?.completed_ids ?? []).length * 10;
    const claimed = Number(claims.rows[0]?.total ?? 0);
    const spent = rows.reduce((sum: number, row: any) => sum + (ITEM_PRICES[row.item_id] ?? 0), 0);
    return NextResponse.json({
      ok: true,
      owned_items: ownedItems,
      balance: earned - claimed - spent,
      spend_summary: {
        purchase_count: rows.length,
        total_spent: spent,
        first_spent_at: rows[0]?.purchased_at ?? null,
        repeat_spender: rows.length > 1,
      },
    });
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
async function getUserHH2Balance(client: import('pg').PoolClient, userFid: number): Promise<number> {
  const progress = await client.query('SELECT completed_ids FROM learning_progress WHERE fid = $1', [userFid]);
  const completedIds: string[] = progress.rows[0]?.completed_ids ?? [];
  const earned = completedIds.length * 10;

  const claimedRows = await client.query('SELECT COALESCE(SUM(amount), 0) AS total FROM hh2_claims WHERE fid = $1', [userFid]);
  const claimed = Number(claimedRows.rows[0]?.total ?? 0);

  const purchaseRows = await client.query('SELECT item_id FROM hh2_purchases WHERE user_fid = $1', [userFid]);
  let spent = 0;
  for (const row of purchaseRows.rows) {
    spent += ITEM_PRICES[row.item_id] ?? 0;
  }

  return earned - claimed - spent;
}

// POST /api/hh2-purchase — deduct HH2 and grant the item
export async function POST(req: NextRequest) {
  const logger = createApiLogger('/hh2-purchase');
  logger.start();

  try {
    // Verify auth via signer key headers
    const authFid = await verifyFarcasterSignerAuth(req);

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

    // Verify the authenticated FID matches
    if (authFid !== userFid) {
      return NextResponse.json(
        { ok: false, error: 'FID does not match authenticated user' },
        { status: 403 }
      );
    }

    const price = ITEM_PRICES[itemId];

    // Use a database transaction with advisory lock to prevent concurrent double-spending.
    const db = getDb();
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const lockRes = await client.query(
        'SELECT pg_try_advisory_xact_lock($1)',
        [userFid]
      );
      if (!lockRes.rows[0]?.pg_try_advisory_xact_lock) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { ok: false, error: 'Another purchase is in progress. Please try again.' },
          { status: 409 }
        );
      }

      // Re-check existing ownership inside the transaction
      const existing = await client.query(
        'SELECT id FROM hh2_purchases WHERE user_fid = $1 AND item_id = $2',
        [userFid, itemId]
      );
      if (existing.rows.length > 0) {
        await client.query('COMMIT');
        return NextResponse.json(
          { ok: true, item_id: itemId, already_owned: true },
          { status: 200 }
        );
      }

      // Check balance
      const balance = await getUserHH2Balance(client, userFid);
      logger.info('Balance check', { userFid, balance, price });

      if (balance < price) {
        await client.query('COMMIT');
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
      await client.query(
        'INSERT INTO hh2_purchases (user_fid, item_id) VALUES ($1, $2)',
        [userFid, itemId]
      );

      await client.query('COMMIT');

      const newBalance = balance - price;

      logger.success('Purchase recorded', { userFid, itemId, price, newBalance });
      logger.end();

      return NextResponse.json({
        ok: true,
        item_id: itemId,
        price,
        balance_remaining: newBalance,
      });
    } catch (txErr: any) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('Purchase failed', error);
    return handleApiError(error, 'POST /hh2-purchase');
  }
}
