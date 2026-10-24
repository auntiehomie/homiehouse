import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import { rateLimit } from '@/lib/ratelimit';
import { createPublicClient, decodeEventLog, formatUnits, http, isAddress, type Hex } from 'viem';
import { base } from 'viem/chains';
import { HH2_BURN_ADDRESS, HH2_STAKING_ABI, HH2_TOKEN_ABI, HH2_TOKEN_ADDRESS } from '@/lib/hh2-contracts';

const stakingAddress = process.env.NEXT_PUBLIC_HH2_STAKING_CONTRACT_ADDRESS;
const baseClient = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org') });

/**
 * HH2 Staking System
 *
 * Users lock wallet-held HH2 in the on-chain escrow for a chosen period. While staked:
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
      amount NUMERIC(78,18) NOT NULL CHECK (amount > 0),
      reason TEXT NOT NULL,
      reference_id TEXT,
      burned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query('ALTER TABLE hh2_burns ALTER COLUMN amount TYPE NUMERIC(78,18) USING amount::numeric');
  await db.query('ALTER TABLE hh2_burns ADD COLUMN IF NOT EXISTS tx_hash TEXT');
  await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_hh2_burns_tx_hash ON hh2_burns (tx_hash) WHERE tx_hash IS NOT NULL');
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_hh2_burns_fid ON hh2_burns (fid)
  `);
  await db.query('ALTER TABLE hh2_stakes ADD COLUMN IF NOT EXISTS contract_stake_id BIGINT');
  await db.query('ALTER TABLE hh2_stakes ADD COLUMN IF NOT EXISTS tx_hash TEXT');
  await db.query('ALTER TABLE hh2_stakes ADD COLUMN IF NOT EXISTS withdrawal_tx_hash TEXT');
  await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_hh2_stakes_chain_tx ON hh2_stakes (tx_hash) WHERE tx_hash IS NOT NULL');
  // Earlier versions recorded virtual stakes without locking tokens. Do not
  // present those records as on-chain stakes or keep them deducted from claims.
  await db.query(`DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'hh2_stakes'::regclass AND conname = 'hh2_stakes_status_check'
        AND pg_get_constraintdef(oid) NOT LIKE '%legacy%'
    ) THEN
      ALTER TABLE hh2_stakes DROP CONSTRAINT hh2_stakes_status_check;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'hh2_stakes'::regclass AND conname = 'hh2_stakes_status_check'
    ) THEN
      ALTER TABLE hh2_stakes ADD CONSTRAINT hh2_stakes_status_check
        CHECK (status IN ('active', 'unlocked', 'withdrawn', 'legacy'));
    END IF;
  END $$`);
  await db.query("UPDATE hh2_stakes SET status = 'legacy' WHERE contract_stake_id IS NULL AND status IN ('active', 'unlocked')");
}

// ── Helper: get user's staking state ──────────────────────────────────────────

export async function getStakingState(client: import('pg').PoolClient, fid: number) {
  const [activeStakes, totalStaked, totalBurned, legacyStakeCount] = await Promise.all([
    client.query(
      `SELECT id, tier_id, amount, staked_at, unlocks_at, status, earnings_multiplier, bonus_earned, contract_stake_id
       FROM hh2_stakes WHERE fid = $1 AND status IN ('active', 'unlocked') ORDER BY staked_at DESC`,
      [fid]
    ),
    client.query(
      `SELECT COALESCE(SUM(amount), 0)::int AS amount FROM hh2_stakes WHERE fid = $1 AND status IN ('active', 'unlocked')`,
      [fid]
    ),
    client.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE reason = 'wallet-burn'), 0)::text AS wallet_amount,
         COALESCE(SUM(amount) FILTER (WHERE reason <> 'wallet-burn'), 0)::text AS perk_amount
       FROM hh2_burns WHERE fid = $1`,
      [fid]
    ),
    client.query("SELECT COUNT(*)::int AS count FROM hh2_stakes WHERE fid = $1 AND status = 'legacy'", [fid]),
  ]);
  return {
    activeStakes: activeStakes.rows,
    totalStaked: totalStaked.rows[0].amount,
    walletBurned: Number(totalBurned.rows[0].wallet_amount),
    perkBurned: Number(totalBurned.rows[0].perk_amount),
    legacyStakeCount: legacyStakeCount.rows[0].count,
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
      // Check for stakes that have matured
      const matured = await client.query(
        `UPDATE hh2_stakes SET status = 'unlocked', unlocked_at = NOW()
         WHERE fid = $1 AND status = 'active' AND unlocks_at <= NOW()
         RETURNING id, tier_id, amount, bonus_earned`,
        [fid]
      );
      const state = await getStakingState(client, fid);

      return NextResponse.json({
        ok: true,
        tiers: STAKING_TIERS,
        activeStakes: state.activeStakes,
        totalStaked: state.totalStaked,
        walletBurned: state.walletBurned,
        perkBurned: state.perkBurned,
        legacyStakeCount: state.legacyStakeCount,
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

async function readSuccessfulTransaction(txHash: unknown, walletAddress: unknown) {
  if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error('A valid Base transaction hash is required.');
  if (typeof walletAddress !== 'string' || !isAddress(walletAddress)) throw new Error('A valid wallet address is required.');
  const transaction = await baseClient.getTransaction({ hash: txHash as Hex });
  const receipt = await baseClient.getTransactionReceipt({ hash: txHash as Hex });
  if (receipt.status !== 'success') throw new Error('The Base transaction did not succeed.');
  if (transaction.from.toLowerCase() !== walletAddress.toLowerCase()) throw new Error('Transaction sender does not match the connected wallet.');
  return { transaction, receipt };
}

function decodeEvent(receipt: Awaited<ReturnType<typeof baseClient.getTransactionReceipt>>, address: string, eventName: 'Staked' | 'Withdrawn' | 'Transfer') {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== address.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: [...HH2_STAKING_ABI, ...HH2_TOKEN_ABI], data: log.data, topics: log.topics, strict: false });
      if (decoded.eventName === eventName) return decoded.args as Record<string, unknown>;
    } catch { /* ignore unrelated logs */ }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`hh2-stake-post:${ip}`, 8, 60).success) return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 });

  try {
    const authFid = await verifyFarcasterSignerAuth(req);
    const body = await req.json();
    const fid = Number(body.fid);
    if (!Number.isSafeInteger(fid) || fid <= 0) return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
    if (authFid !== fid) return NextResponse.json({ ok: false, error: 'FID does not match authenticated user' }, { status: 403 });

    const txHash = body.txHash as Hex;
    const walletAddress = body.walletAddress;
    const { transaction, receipt } = await readSuccessfulTransaction(txHash, walletAddress);

    if (body.action === 'burn') {
      if (transaction.to?.toLowerCase() !== HH2_TOKEN_ADDRESS.toLowerCase()) return NextResponse.json({ ok: false, error: 'Burn transaction must call the HH2 token contract.' }, { status: 400 });
      const event = decodeEvent(receipt, HH2_TOKEN_ADDRESS, 'Transfer');
      if (!event || String(event.from).toLowerCase() !== String(walletAddress).toLowerCase() || String(event.to).toLowerCase() !== HH2_BURN_ADDRESS.toLowerCase() || typeof event.value !== 'bigint' || event.value <= 0n) {
        return NextResponse.json({ ok: false, error: 'No HH2 transfer to the burn address was found in this transaction.' }, { status: 400 });
      }
      const db = getDb();
      await ensureStakingTables(db);
      const amount = formatUnits(event.value, 18);
      await db.query(
        `INSERT INTO hh2_burns (fid, amount, reason, reference_id, tx_hash)
         VALUES ($1, $2, 'wallet-burn', 'onchain', $3) ON CONFLICT (tx_hash) WHERE tx_hash IS NOT NULL DO NOTHING`,
        [fid, amount, txHash],
      );
      return NextResponse.json({ ok: true, amount, txHash });
    }

    if (body.action !== 'stake') return NextResponse.json({ ok: false, error: 'Action must be stake or burn.' }, { status: 400 });
    if (!stakingAddress || !isAddress(stakingAddress)) return NextResponse.json({ ok: false, error: 'On-chain staking contract is not configured.' }, { status: 503 });
    if (transaction.to?.toLowerCase() !== stakingAddress.toLowerCase()) return NextResponse.json({ ok: false, error: 'Transaction does not call the configured HH2 staking contract.' }, { status: 400 });
    const tierId = typeof body.tierId === 'string' ? body.tierId : '';
    const tier = TIER_BY_ID[tierId];
    const tierIndex = STAKING_TIERS.findIndex((item) => item.id === tierId);
    const amount = Number(body.amount);
    if (!tier || !Number.isSafeInteger(amount) || amount < tier.minStake || amount > tier.maxStake) return NextResponse.json({ ok: false, error: 'Stake amount or tier is invalid.' }, { status: 400 });
    const event = decodeEvent(receipt, stakingAddress, 'Staked');
    const expectedAmount = BigInt(amount) * 10n ** 18n;
    if (!event || String(event.account).toLowerCase() !== String(walletAddress).toLowerCase() || BigInt(String(event.fid)) !== BigInt(fid) || Number(event.tierId) !== tierIndex || event.amount !== expectedAmount) {
      return NextResponse.json({ ok: false, error: 'The confirmed transaction does not match this stake request.' }, { status: 400 });
    }

    const db = getDb();
    await ensureStakingTables(db);
    const prior = await db.query('SELECT id FROM hh2_stakes WHERE tx_hash = $1', [txHash]);
    if (prior.rows.length) return NextResponse.json({ ok: true, duplicate: true });
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [fid]);
      const result = await client.query(
        `INSERT INTO hh2_stakes (fid, tier_id, amount, unlocks_at, earnings_multiplier, contract_stake_id, tx_hash)
         VALUES ($1, $2, $3, to_timestamp($4), $5, $6, $7)
         ON CONFLICT (tx_hash) WHERE tx_hash IS NOT NULL DO NOTHING
         RETURNING id, staked_at, unlocks_at, contract_stake_id`,
        [fid, tier.id, amount, Number(event.unlocksAt), tier.earningsMultiplier, String(event.stakeId), txHash],
      );
      await client.query('COMMIT');
      return NextResponse.json({ ok: true, stake: result.rows[0] ?? null });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof Error && /transaction|wallet|Base|burn|HH2|stake|sender|address/i.test(error.message)) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    console.error('[hh2-stake] POST error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to verify HH2 transaction.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authFid = await verifyFarcasterSignerAuth(req);
    const body = await req.json();
    const fid = Number(body.fid);
    if (!Number.isSafeInteger(fid) || fid <= 0) return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
    if (authFid !== fid) return NextResponse.json({ ok: false, error: 'FID does not match authenticated user' }, { status: 403 });
    if (!stakingAddress || !isAddress(stakingAddress)) return NextResponse.json({ ok: false, error: 'On-chain staking contract is not configured.' }, { status: 503 });

    const { transaction, receipt } = await readSuccessfulTransaction(body.txHash, body.walletAddress);
    if (transaction.to?.toLowerCase() !== stakingAddress.toLowerCase()) return NextResponse.json({ ok: false, error: 'Transaction does not call the configured HH2 staking contract.' }, { status: 400 });
    const event = decodeEvent(receipt, stakingAddress, 'Withdrawn');
    if (!event || String(event.account).toLowerCase() !== String(body.walletAddress).toLowerCase() || BigInt(String(event.fid)) !== BigInt(fid) || BigInt(String(event.stakeId)) !== BigInt(body.contractStakeId)) {
      return NextResponse.json({ ok: false, error: 'The confirmed transaction does not match this withdrawal.' }, { status: 400 });
    }
    if (typeof event.amount !== 'bigint') return NextResponse.json({ ok: false, error: 'Withdrawal event amount is invalid.' }, { status: 400 });
    const withdrawnAmountWei = event.amount;

    const db = getDb();
    await ensureStakingTables(db);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [fid]);
      const result = await client.query(
        `UPDATE hh2_stakes SET status = 'withdrawn', withdrawn_at = NOW(), withdrawal_tx_hash = $1
         WHERE fid = $2 AND contract_stake_id = $3 AND status IN ('active', 'unlocked')
         RETURNING id, amount, bonus_earned`,
        [body.txHash, fid, String(event.stakeId)],
      );
      if (!result.rows.length) {
        const already = await client.query('SELECT status FROM hh2_stakes WHERE fid = $1 AND contract_stake_id = $2', [fid, String(event.stakeId)]);
        if (already.rows[0]?.status === 'withdrawn') {
          await client.query('COMMIT');
          return NextResponse.json({ ok: true, duplicate: true, withdrawnAmountWei: withdrawnAmountWei.toString(), bonusEarned: 0 });
        }
        await client.query('ROLLBACK');
        return NextResponse.json({ ok: false, error: 'Stake not found for this account.' }, { status: 404 });
      }
      const stake = result.rows[0];
      if (stake.bonus_earned > 0) {
        await client.query(
          `INSERT INTO hh2_reward_events (fid, module_id, amount, status)
           VALUES ($1, $2, $3, 'earned') ON CONFLICT (fid, module_id) DO NOTHING`,
          [fid, `stake-bonus-${stake.id}`, stake.bonus_earned],
        );
      }
      await client.query('COMMIT');
      return NextResponse.json({ ok: true, withdrawnAmountWei: withdrawnAmountWei.toString(), bonusEarned: stake.bonus_earned });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof Error && /transaction|wallet|Base|burn|HH2|stake|sender|address/i.test(error.message)) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    console.error('[hh2-stake] DELETE error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to verify HH2 withdrawal.' }, { status: 500 });
  }
}
