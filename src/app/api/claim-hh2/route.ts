import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { createPublicClient, createWalletClient, http, parseUnits, isAddress } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { getDb } from '@/lib/db';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import { ITEM_PRICES } from '@/app/api/hh2-shop/route';

const HH2_CONTRACT = '0x5C5F3618e82C4b32e26De858ca66331D9A722B07' as const;
const HH2_PER_MODULE = 100;
const HH2_DECIMALS = 18;
const MAX_REWARDED_MODULES_PER_FID = 50;
const MAX_MODULES_PER_CLAIM = 5;

const ERC20_ABI = [{
  name: 'transfer', type: 'function' as const, stateMutability: 'nonpayable' as const,
  inputs: [{ name: 'to', type: 'address' as const }, { name: 'amount', type: 'uint256' as const }],
  outputs: [{ name: '', type: 'bool' as const }],
}];

function getTreasuryAccount() {
  const key = process.env.TREASURY_PRIVATE_KEY;
  if (!key) throw new Error('TREASURY_PRIVATE_KEY is not configured');
  return privateKeyToAccount((key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`);
}

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
      amount INTEGER NOT NULL CHECK (amount = 100),
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

async function getClaimable(client: import('pg').PoolClient, fid: number) {
  const [earned, purchases, pending] = await Promise.all([
    client.query(`
      SELECT COALESCE(SUM(e.amount), 0)::int AS amount
      FROM hh2_reward_events e
      JOIN learning_reward_attempts a ON a.fid = e.fid AND a.module_id = e.module_id
      JOIN learning_reward_plans p ON p.fid = e.fid
      WHERE e.fid = $1 AND e.status = 'earned' AND a.completed_at IS NOT NULL
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(p.plan->'modules') m WHERE m->>'id' = e.module_id)
        AND NOT EXISTS (SELECT 1 FROM hh2_claims c WHERE c.fid = e.fid AND c.module_id = e.module_id)
    `, [fid]),
    client.query('SELECT item_id FROM hh2_purchases WHERE user_fid = $1', [fid]),
    client.query("SELECT COUNT(*)::int AS count FROM hh2_reward_events WHERE fid = $1 AND status = 'pending'", [fid]),
  ]);
  const spent = purchases.rows.reduce((sum: number, row: { item_id: string }) => sum + (ITEM_PRICES[row.item_id] ?? 0), 0);
  const claimed = await client.query('SELECT COUNT(*)::int AS count FROM hh2_claims WHERE fid = $1', [fid]);
  const remainingLifetime = Math.max(0, MAX_REWARDED_MODULES_PER_FID - claimed.rows[0].count);
  const amount = Math.min(Math.max(0, earned.rows[0].amount - spent), remainingLifetime * HH2_PER_MODULE);
  return { amount, modules: Math.floor(amount / HH2_PER_MODULE), pending: pending.rows[0].count };
}

export async function GET(req: NextRequest) {
  let authFid: number;
  try { authFid = await verifyFarcasterSignerAuth(req); } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
  }
  const fid = Number(new URL(req.url).searchParams.get('fid'));
  if (!Number.isSafeInteger(fid) || fid <= 0) return NextResponse.json({ ok: false, error: 'fid required' }, { status: 400 });
  if (authFid !== fid) return NextResponse.json({ ok: false, error: 'FID does not match authenticated user' }, { status: 403 });

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`claim-hh2:${ip}`, 30, 60).success) {
      return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 });
    }
    const db = getDb();
    await ensureRewardTables(db);
    const client = await db.connect();
    try {
      const balance = await getClaimable(client, fid);
      const claimed = await client.query('SELECT COALESCE(SUM(amount), 0)::int AS amount FROM hh2_claims WHERE fid = $1', [fid]);
      return NextResponse.json({
        ok: true, claimsPaused: false,
        claimable: balance.modules * HH2_PER_MODULE,
        claimableModules: balance.modules,
        totalClaimed: claimed.rows[0].amount,
        pendingModules: balance.pending,
        claims: [],
      });
    } finally { client.release(); }
  } catch (error) {
    console.error('[claim-hh2] GET error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to check claimable HH2' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`claim-hh2-post:${ip}`, 5, 60).success) {
    return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 });
  }
  let authFid: number;
  try { authFid = await verifyFarcasterSignerAuth(req); } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
  }
  let body: { fid?: unknown; walletAddress?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }
  const fid = Number(body.fid);
  const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress : '';
  if (!Number.isSafeInteger(fid) || fid <= 0) return NextResponse.json({ ok: false, error: 'Invalid fid' }, { status: 400 });
  if (authFid !== fid) return NextResponse.json({ ok: false, error: 'FID does not match authenticated user' }, { status: 403 });
  if (!isAddress(walletAddress)) return NextResponse.json({ ok: false, error: 'Invalid wallet address' }, { status: 400 });

  const db = getDb();
  let modules: string[] = [];
  try {
    await ensureRewardTables(db);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [fid]);
      const balance = await getClaimable(client, fid);
      if (balance.pending > 0) {
        await client.query('COMMIT');
        return NextResponse.json({ ok: false, error: 'A claim is already processing.' }, { status: 409 });
      }
      if (balance.modules === 0) {
        await client.query('COMMIT');
        return NextResponse.json({ ok: false, error: 'Nothing verified is ready to claim.' }, { status: 400 });
      }
      const earned = await client.query(
        `SELECT e.module_id FROM hh2_reward_events e
          JOIN learning_reward_attempts a ON a.fid = e.fid AND a.module_id = e.module_id
          JOIN learning_reward_plans p ON p.fid = e.fid
          WHERE e.fid = $1 AND e.status = 'earned' AND a.completed_at IS NOT NULL
            AND EXISTS (SELECT 1 FROM jsonb_array_elements(p.plan->'modules') m WHERE m->>'id' = e.module_id)
            AND NOT EXISTS (SELECT 1 FROM hh2_claims c WHERE c.fid = e.fid AND c.module_id = e.module_id)
          ORDER BY e.earned_at ASC LIMIT $2 FOR UPDATE OF e`,
        [fid, Math.min(balance.modules, MAX_MODULES_PER_CLAIM)],
      );
      modules = earned.rows.map((row: { module_id: string }) => row.module_id);
      if (modules.length === 0) throw new Error('No verified reward events available for reservation');
      await client.query(
        "UPDATE hh2_reward_events SET status = 'pending', wallet_address = $3 WHERE fid = $1 AND module_id = ANY($2::text[]) AND status = 'earned'",
        [fid, modules, walletAddress.toLowerCase()],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }

    const account = getTreasuryAccount();
    const walletClient = createWalletClient({ account, chain: base, transport: http() });
    const publicClient = createPublicClient({ chain: base, transport: http() });
    const amount = parseUnits(String(modules.length * HH2_PER_MODULE), HH2_DECIMALS);
    const txHash = await walletClient.writeContract({
      address: HH2_CONTRACT, abi: ERC20_ABI, functionName: 'transfer',
      args: [walletAddress as `0x${string}`, amount],
    });

    await db.query(
      "UPDATE hh2_reward_events SET claim_tx_hash = $3 WHERE fid = $1 AND module_id = ANY($2::text[]) AND status = 'pending'",
      [fid, modules, txHash],
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      await db.query(
        "UPDATE hh2_reward_events SET status = 'earned', wallet_address = NULL, claim_tx_hash = NULL WHERE fid = $1 AND module_id = ANY($2::text[]) AND claim_tx_hash = $3",
        [fid, modules, txHash],
      );
      return NextResponse.json({ ok: false, error: 'The token transfer did not succeed. Your verified rewards are available to retry.' }, { status: 502 });
    }

    const claimClient = await db.connect();
    try {
      await claimClient.query('BEGIN');
      await claimClient.query('SELECT pg_advisory_xact_lock($1)', [fid]);
      await claimClient.query(
        "UPDATE hh2_reward_events SET status = 'claimed', claimed_at = NOW() WHERE fid = $1 AND module_id = ANY($2::text[]) AND claim_tx_hash = $3 AND status = 'pending'",
        [fid, modules, txHash],
      );
      for (const moduleId of modules) {
        await claimClient.query(
          'INSERT INTO hh2_claims (fid, module_id, wallet_address, tx_hash, amount) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (fid, module_id) DO NOTHING',
          [fid, moduleId, walletAddress.toLowerCase(), txHash, HH2_PER_MODULE],
        );
      }
      await claimClient.query('COMMIT');
    } catch (error) {
      await claimClient.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { claimClient.release(); }
    return NextResponse.json({ ok: true, claimed: modules.length, amount: modules.length * HH2_PER_MODULE, txHash });
  } catch (error) {
    // A timed-out RPC may have broadcast a payment. Preserve pending rows for reconciliation.
    console.error('[claim-hh2] POST error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to claim verified HH2 rewards' }, { status: 500 });
  }
}
