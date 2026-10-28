import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { enforceRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';
import { handleApiError, AuthError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { ITEM_PRICES, VALID_ITEM_IDS, SHOP_ITEMS } from '@/app/api/hh2-shop/route';
import { activateBoost } from '@/lib/active-boosts';
import { recordBurn } from '@/app/api/hh2-stake/route';

// 10% of every shop purchase is permanently burned, creating deflationary pressure
const BURN_PERCENTAGE = 0.10;

// Burn-for-boost items can be purchased repeatedly (they're consumable, not permanent)
const BURN_ITEM_IDS = new Set(
  SHOP_ITEMS.filter(item => item.id.startsWith('burn-')).map(item => item.id)
);

async function ensureRewardTables(db: ReturnType<typeof getDb>) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS hh2_purchases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_fid INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      purchased_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_fid, item_id)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS hh2_reward_events (
      fid INTEGER NOT NULL, module_id TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK (amount > 0),
      status TEXT NOT NULL DEFAULT 'earned' CHECK (status IN ('earned', 'pending', 'claimed')),
      wallet_address TEXT, claim_tx_hash TEXT,
      earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), claimed_at TIMESTAMPTZ,
      PRIMARY KEY (fid, module_id)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS hh2_claims (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), fid INTEGER NOT NULL,
      module_id TEXT NOT NULL, wallet_address TEXT NOT NULL, tx_hash TEXT NOT NULL,
      amount INTEGER NOT NULL, claimed_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(fid, module_id)
    )
  `);
}

async function getUserHH2Balance(client: import('pg').PoolClient, fid: number): Promise<number> {
  const [earned, spent] = await Promise.all([
    client.query(
      "SELECT COALESCE(SUM(amount), 0)::int AS amount FROM hh2_reward_events WHERE fid = $1 AND status = 'earned'",
      [fid],
    ),
    client.query(
      'SELECT item_id FROM hh2_purchases WHERE user_fid = $1',
      [fid],
    ),
  ]);
  const spentAmount = spent.rows.reduce((sum: number, row: { item_id: string }) => sum + (ITEM_PRICES[row.item_id] ?? 0), 0);
  return Math.max(0, earned.rows[0].amount - spentAmount);
}

export async function GET(req: NextRequest) {
  try {
    const authFid = await verifyFarcasterSignerAuth(req);
    const userFid = Number(new URL(req.url).searchParams.get('fid'));
    if (!Number.isSafeInteger(userFid) || userFid <= 0) {
      return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
    }
    if (authFid !== userFid) {
      return NextResponse.json({ ok: false, error: 'FID does not match authenticated user' }, { status: 403 });
    }

    const db = getDb();
    await ensureRewardTables(db);
    const [purchases, client] = await Promise.all([
      db.query('SELECT item_id, purchased_at FROM hh2_purchases WHERE user_fid = $1 ORDER BY purchased_at ASC', [userFid]),
      db.connect(),
    ]);
    try {
      const balance = await getUserHH2Balance(client, userFid);
      const rows = purchases.rows as Array<{ item_id: string; purchased_at: string }>;
      const totalSpent = rows.reduce((sum, row) => sum + (ITEM_PRICES[row.item_id] ?? 0), 0);
      return NextResponse.json({
        ok: true,
        owned_items: rows.map(row => row.item_id),
        balance,
        spend_summary: {
          purchase_count: rows.length,
          total_spent: totalSpent,
          first_spent_at: rows[0]?.purchased_at ?? null,
          repeat_spender: rows.length > 1,
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error('[hh2-purchase] GET error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch purchases' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const logger = createApiLogger('/hh2-purchase');
  logger.start();
  try {
    const authFid = await verifyFarcasterSignerAuth(req);
    await enforceRateLimit({
      key: rateLimitKeyFromRequest(req), limit: 10, windowSeconds: 60, label: 'hh2-purchase',
    });
    const body = await req.json();
    const userFid = Number(body.fid);
    const itemId = typeof body.itemId === 'string' ? body.itemId : '';
    if (!Number.isSafeInteger(userFid) || userFid <= 0) {
      return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
    }
    if (!VALID_ITEM_IDS.has(itemId)) {
      return NextResponse.json({ ok: false, error: 'Invalid shop item' }, { status: 400 });
    }
    if (authFid !== userFid) {
      return NextResponse.json({ ok: false, error: 'FID does not match authenticated user' }, { status: 403 });
    }

    const price = ITEM_PRICES[itemId];
    const db = getDb();
    await ensureRewardTables(db);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [userFid]);
      const isBurnItem = BURN_ITEM_IDS.has(itemId);
      if (!isBurnItem) {
        const existing = await client.query(
          'SELECT id FROM hh2_purchases WHERE user_fid = $1 AND item_id = $2 FOR UPDATE',
          [userFid, itemId],
        );
        if (existing.rows.length > 0) {
          await client.query('COMMIT');
          return NextResponse.json({ ok: false, error: 'You already own this item.', already_owned: true }, { status: 409 });
        }
      }
      const balance = await getUserHH2Balance(client, userFid);
      logger.info('Balance check', { userFid, balance, price });
      if (balance < price) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { ok: false, error: `Insufficient HH2 balance. You have ${balance} HH2, need ${price} HH2.`, balance, required: price },
          { status: 402 },
        );
      }
      // Record the purchase
      await client.query('INSERT INTO hh2_purchases (user_fid, item_id) VALUES ($1, $2)', [userFid, itemId]);

      // Burn 10% of the purchase price — permanent deflationary pressure
      const burnAmount = Math.floor(price * BURN_PERCENTAGE);
      if (burnAmount > 0) {
        try {
          await client.query(
            'INSERT INTO hh2_burns (fid, amount, reason, reference_id) VALUES ($1, $2, $3, $4)',
            [userFid, burnAmount, 'shop-purchase-burn', itemId]
          );
        } catch { /* non-blocking — burn ledger is best-effort */ }
      }
      await client.query('COMMIT');

      // Activate boost effect outside the transaction (non-critical — best-effort)
      let boostExpiry: Date | null = null;
      if (isBurnItem) {
        try { boostExpiry = await activateBoost(userFid, itemId); } catch (e) { console.warn('[hh2-purchase] boost activation failed:', e); }
      }

      logger.success('Purchase recorded', { userFid, itemId, price, newBalance: balance - price, isBurn: isBurnItem, burnAmount });
      logger.end();
      return NextResponse.json({ ok: true, item_id: itemId, price, balance_remaining: balance - price, boost_expires_at: boostExpiry?.toISOString() ?? null, burned: burnAmount });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Purchase failed', error);
    return handleApiError(error, 'POST /hh2-purchase');
  }
}
