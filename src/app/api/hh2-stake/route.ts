import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import { rateLimit } from '@/lib/ratelimit';

/**
 * HH2 Staking System
 *
 * Users lock their earned (unclaimed) HH2 for a chosen period. While staked:
 * - They earn boosted learning rewards (1.5x for 30d, 2x for 90d, 2.5x for 180d)
 * - Staked HH2 cannot be spent in the shop or claimed to wallet
 * - After the lock period, staked HH2 + bonus rewards are fully claimable
 *
 * This creates organic demand to hold HH2 rather than immediately selling,
 * reducing circulating supply and supporting token value.
 *
 * No artificial inflation — rewards come from the same learning-completion mechanism,
 * just at a boosted rate for committed stakers.
 */

// ── Staking tiers ────────────────────────────────────────────────────────────

export interface StakingTier {
  id: string;
  name: string;
  lockDays: number;
  earningsMultiplier: number;
  minStake: number;
  maxStake: number;
  emoji: string;
  description: string;
}

export const STAKING_TIERS: StakingTier[] = [
  {
    id: 'flex-30',
    name: 'Flex Stake (30d)',
    lockDays: 30,
    earningsMultiplier: 1.5,
    minStake: 200,
    maxStake: 5000,
    emoji: '🟢',
    description: 'Lock HH2 for 30 days. Earn 1.5× on all new learning modules while staked.',
  },
  {
    id: 'commit-90',
    name: 'Commit Stake (90d)',
    lockDays: 90,
    earningsMultiplier: 2.0,
    minStake: 500,
    maxStake: 10000,
    emoji: '🔵',
    description: 'Lock HH2 for 90 days. Earn 2× on all new learning modules while staked.',
  },
  {
    id: 'diamond-180',
    name: 'Diamond Stake (180d)',
    lockDays: 180,
    earningsMultiplier: 2.5,
    minStake: 1000,
    maxStake: 20000,
    emoji: '💎',
    description: 'Lock HH2 for 180 days. Earn 2.5× on all new learning modules while staked. For the most committed learners.',
  },
];

export const TIER_BY_ID = STAKING_TIERS.reduce((acc, t) => { acc[t.id] = t; return acc; }, {} as Record<string, StakingTier>);

// ── DB schema ────────────────────────────────────────────────────────────────

export async function ensureStakingTables(db: ReturnType<typeof getDb>) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS hh2_stakes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      fid INTEGER NOT NULL,
      tier_id TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK (amount > 0),
      staked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      unlocks_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unlocked', 'withdrawn')),
      unlocked_at TIMESTAMPTZ,
      withdrawn_at TIMESTAMPTZ,
      earnings_multiplier NUMERIC(3,1) NOT NULL,
      bonus_earned INTEGER NOT NULL DEFAULT 0
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_hh2_stakes_fid_status ON hh2_stakes (fid, status)
  `);
  // Burn ledger — tracks HH2 permanently removed from circulation
  await db.query(`
    CREATE TABLE IF NOT EXISTS hh2_burns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      fid INTEGER NOT NULL,
      amount INTEGER NOT NULL CHECK (amount > 0),
      reason TEXT NOT NULL,
      reference_id TEXT,
      burned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_hh2_burns_fid ON hh2_burns (fid)
  `);
}

// ── Helper: get user's staking state ──────────────────────────────────────────

export async function getStakingState(client: import('pg').PoolClient, fid: number) {
  const [activeStakes, totalStaked, totalBurned] = await Promise.all([
    client.query(
      `SELECT id, tier_id, amount, staked_at, unlocks_at, status, earnings_multiplier, bonus_earned
       FROM hh2_stakes WHERE fid = $1 AND status = 'active' ORDER BY staked_at DESC`,
      [fid]
    ),
    client.query(
      `SELECT COALESCE(SUM(amount), 0)::int AS amount FROM hh2_stakes WHERE fid = $1 AND status = 'active'`,
      [fid]
    ),
    client.query(
      `SELECT COALESCE(SUM(amount), 0)::int AS amount FROM hh2_burns WHERE fid = $1`,
      [fid]
    ),
  ]);
  return {
    activeStakes: activeStakes.rows,
    totalStaked: totalStaked.rows[0].amount,
    totalBurned: totalBurned.rows[0].amount,
  };
}

// ── Helper: get effective earnings multiplier for a user ─────────────────────

export async function getEarningsMultiplier(client: import('pg').PoolClient, fid: number): Promise<number> {
  const result = await client.query(
    `SELECT MAX(earnings_multiplier)::float AS multiplier
     FROM hh2_stakes WHERE fid = $1 AND status = 'active'`,
    [fid]
  );
  return result.rows[0]?.multiplier || 1.0;
}

// ── Helper: record a burn ────────────────────────────────────────────────────

export async function recordBurn(
  client: import('pg').PoolClient,
  fid: number,
  amount: number,
  reason: string,
  referenceId?: string,
) {
  await client.query(
    'INSERT INTO hh2_burns (fid, amount, reason, reference_id) VALUES ($1, $2, $3, $4)',
    [fid, amount, reason, referenceId ?? null]
  );
}

// ── GET: staking dashboard ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const authFid = await verifyFarcasterSignerAuth(req);
    const fid = Number(new URL(req.url).searchParams.get('fid'));
    if (!Number.isSafeInteger(fid) || fid <= 0) {
      return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
    }
    if (authFid !== fid) {
      return NextResponse.json({ ok: false, error: 'FID does not match authenticated user' }, { status: 403 });
    }

    const db = getDb();
    await ensureStakingTables(db);
    const client = await db.connect();
    try {
      const state = await getStakingState(client, fid);

      // Check for stakes that have matured
      const matured = await client.query(
        `UPDATE hh2_stakes SET status = 'unlocked', unlocked_at = NOW()
         WHERE fid = $1 AND status = 'active' AND unlocks_at <= NOW()
         RETURNING id, tier_id, amount, bonus_earned`,
        [fid]
      );

      return NextResponse.json({
        ok: true,
        tiers: STAKING_TIERS,
        activeStakes: state.activeStakes,
        totalStaked: state.totalStaked,
        totalBurned: state.totalBurned,
        maturedCount: matured.rows.length,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error('[hh2-stake] GET error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch staking state' }, { status: 500 });
  }
}

// ── POST: create a stake ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`hh2-stake-post:${ip}`, 5, 60).success) {
    return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 });
  }

  try {
    const authFid = await verifyFarcasterSignerAuth(req);
    const body = await req.json();
    const fid = Number(body.fid);
    const tierId = typeof body.tierId === 'string' ? body.tierId : '';
    const amount = Number(body.amount);

    if (!Number.isSafeInteger(fid) || fid <= 0) {
      return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
    }
    if (authFid !== fid) {
      return NextResponse.json({ ok: false, error: 'FID does not match authenticated user' }, { status: 403 });
    }
    const tier = TIER_BY_ID[tierId];
    if (!tier) {
      return NextResponse.json({ ok: false, error: 'Invalid staking tier' }, { status: 400 });
    }
    if (!Number.isSafeInteger(amount) || amount < tier.minStake) {
      return NextResponse.json({ ok: false, error: `Minimum stake for ${tier.name} is ${tier.minStake} HH2` }, { status: 400 });
    }
    if (amount > tier.maxStake) {
      return NextResponse.json({ ok: false, error: `Maximum stake for ${tier.name} is ${tier.maxStake} HH2` }, { status: 400 });
    }

    const db = getDb();
    await ensureStakingTables(db);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [fid]);

      // Check available HH2 balance (earned - spent - currently staked)
      const [earned, spent, staked] = await Promise.all([
        client.query(
          "SELECT COALESCE(SUM(amount), 0)::int AS amount FROM hh2_reward_events WHERE fid = $1 AND status = 'earned'",
          [fid]
        ),
        client.query('SELECT item_id FROM hh2_purchases WHERE user_fid = $1', [fid]),
        client.query(
          "SELECT COALESCE(SUM(amount), 0)::int AS amount FROM hh2_stakes WHERE fid = $1 AND status IN ('active', 'unlocked')",
          [fid]
        ),
      ]);

      const { ITEM_PRICES } = await import('@/app/api/hh2-shop/route');
      const spentAmount = spent.rows.reduce((sum: number, row: { item_id: string }) => sum + (ITEM_PRICES[row.item_id] ?? 0), 0);
      const availableBalance = Math.max(0, earned.rows[0].amount - spentAmount - staked.rows[0].amount);

      if (amount > availableBalance) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { ok: false, error: `Insufficient HH2. Available: ${availableBalance}, requested: ${amount}` },
          { status: 402 }
        );
      }

      const unlocksAt = new Date(Date.now() + tier.lockDays * 24 * 60 * 60 * 1000);

      const result = await client.query(
        `INSERT INTO hh2_stakes (fid, tier_id, amount, unlocks_at, earnings_multiplier)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, staked_at, unlocks_at`,
        [fid, tier.id, amount, unlocksAt, tier.earningsMultiplier]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        ok: true,
        stake: {
          id: result.rows[0].id,
          tierId: tier.id,
          tierName: tier.name,
          amount,
          stakedAt: result.rows[0].staked_at,
          unlocksAt: result.rows[0].unlocks_at,
          earningsMultiplier: tier.earningsMultiplier,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error('[hh2-stake] POST error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to create stake' }, { status: 500 });
  }
}

// ── DELETE: withdraw a matured stake ──────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const authFid = await verifyFarcasterSignerAuth(req);
    const body = await req.json();
    const fid = Number(body.fid);
    const stakeId = typeof body.stakeId === 'string' ? body.stakeId : '';

    if (!Number.isSafeInteger(fid) || fid <= 0) {
      return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
    }
    if (authFid !== fid) {
      return NextResponse.json({ ok: false, error: 'FID does not match authenticated user' }, { status: 403 });
    }
    if (!stakeId) {
      return NextResponse.json({ ok: false, error: 'stakeId required' }, { status: 400 });
    }

    const db = getDb();
    await ensureStakingTables(db);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [fid]);

      const stake = await client.query(
        `SELECT id, tier_id, amount, bonus_earned, status, unlocks_at
         FROM hh2_stakes WHERE id = $1 AND fid = $2 FOR UPDATE`,
        [stakeId, fid]
      );

      if (stake.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ ok: false, error: 'Stake not found' }, { status: 404 });
      }

      const s = stake.rows[0];
      if (s.status === 'withdrawn') {
        await client.query('ROLLBACK');
        return NextResponse.json({ ok: false, error: 'Stake already withdrawn' }, { status: 400 });
      }
      if (s.status === 'active' && new Date(s.unlocks_at) > new Date()) {
        await client.query('ROLLBACK');
        return NextResponse.json({ ok: false, error: 'Stake is still locked' }, { status: 400 });
      }

      // Mark as withdrawn — the staked amount returns to the user's claimable balance
      // and bonus_earned is added as new reward events
      await client.query(
        `UPDATE hh2_stakes SET status = 'withdrawn', withdrawn_at = NOW() WHERE id = $1`,
        [stakeId]
      );

      // If there were bonus earnings during the stake period, record them
      if (s.bonus_earned > 0) {
        const bonusModuleId = `stake-bonus-${stakeId}`;
        await client.query(
          `INSERT INTO hh2_reward_events (fid, module_id, amount, status)
           VALUES ($1, $2, $3, 'earned')
           ON CONFLICT (fid, module_id) DO NOTHING`,
          [fid, bonusModuleId, s.bonus_earned]
        );
      }

      await client.query('COMMIT');

      return NextResponse.json({
        ok: true,
        withdrawnAmount: s.amount,
        bonusEarned: s.bonus_earned,
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error('[hh2-stake] DELETE error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to withdraw stake' }, { status: 500 });
  }
}
