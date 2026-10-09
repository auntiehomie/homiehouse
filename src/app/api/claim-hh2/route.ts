import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { createPublicClient, createWalletClient, http, parseUnits, isAddress } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { getDb } from '@/lib/db';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';

const HH2_CONTRACT = '0x5C5F3618e82C4b32e26De858ca66331D9A722B07' as const;
const HH2_PER_MODULE = 100;
const HH2_DECIMALS = 18;

const ERC20_ABI = [{
  name: 'transfer', type: 'function' as const, stateMutability: 'nonpayable' as const,
  inputs: [{ name: 'to', type: 'address' as const }, { name: 'amount', type: 'uint256' as const }],
  outputs: [{ name: '', type: 'bool' as const }],
}];

function getTreasuryAccount() {
  const key = process.env.TREASURY_PRIVATE_KEY;
  if (!key) throw new Error('TREASURY_PRIVATE_KEY is not configured');
  const hex = (key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`;
  return privateKeyToAccount(hex);
}

async function ensureRewardTables(db: ReturnType<typeof getDb>) {
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

export async function GET(req: NextRequest) {
  let authFid: number;
  try { authFid = await verifyFarcasterSignerAuth(req); } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const fid = Number(searchParams.get('fid'));
  if (!Number.isSafeInteger(fid) || fid <= 0) return NextResponse.json({ ok: false, error: 'fid required' }, { status: 400 });
  if (authFid !== fid) return NextResponse.json({ ok: false, error: 'FID does not match authenticated user' }, { status: 403 });

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`claim-hh2:${ip}`, 30, 60).success) {
      return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 });
    }
    const db = getDb();
    await ensureRewardTables(db);
    const [available, claimed, pending] = await Promise.all([
      db.query('SELECT COALESCE(SUM(amount), 0)::int AS amount, COUNT(*)::int AS modules FROM hh2_reward_events WHERE fid = $1 AND status = $2', [fid, 'earned']),
      db.query('SELECT COALESCE(SUM(amount), 0)::int AS amount FROM hh2_claims WHERE fid = $1', [fid]),
      db.query('SELECT COUNT(*)::int AS count FROM hh2_reward_events WHERE fid = $1 AND status = $2', [fid, 'pending']),
    ]);
    return NextResponse.json({
      ok: true,
      claimsPaused: false,
      claimable: available.rows[0].amount,
      claimableModules: available.rows[0].modules,
      totalClaimed: claimed.rows[0].amount,
      pendingModules: pending.rows[0].count,
      claims: [],
    });
  } catch (error) {
    console.error('[claim-hh2] GET error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to check claimable HH2' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
      const earned = await client.query(
        'SELECT module_id FROM hh2_reward_events WHERE fid = $1 AND status = $2 FOR UPDATE',
        [fid, 'earned']
      );
      if (earned.rows.length === 0) {
        const pending = await client.query(
          'SELECT COUNT(*)::int AS count FROM hh2_reward_events WHERE fid = $1 AND status = $2',
          [fid, 'pending']
        );
        await client.query('COMMIT');
        return NextResponse.json(
          { ok: false, error: pending.rows[0].count ? 'A claim is already processing.' : 'Nothing verified is ready to claim.' },
          { status: pending.rows[0].count ? 409 : 400 }
        );
      }

      modules = earned.rows.map((row: { module_id: string }) => row.module_id);
      await client.query(
        'UPDATE hh2_reward_events SET status = $3, wallet_address = $4 WHERE fid = $1 AND module_id = ANY($2::text[]) AND status = $5',
        [fid, modules, 'pending', walletAddress.toLowerCase(), 'earned']
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    const account = getTreasuryAccount();
    const walletClient = createWalletClient({ account, chain: base, transport: http() });
    const publicClient = createPublicClient({ chain: base, transport: http() });
    const amount = parseUnits(String(modules.length * HH2_PER_MODULE), HH2_DECIMALS);
    const txHash = await walletClient.writeContract({
      address: HH2_CONTRACT, abi: ERC20_ABI, functionName: 'transfer',
      args: [walletAddress as `0x${string}`, amount],
    });

    await db.query(
      'UPDATE hh2_reward_events SET claim_tx_hash = $3 WHERE fid = $1 AND module_id = ANY($2::text[]) AND status = $4',
      [fid, modules, txHash, 'pending']
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      await db.query(
        'UPDATE hh2_reward_events SET status = $4, wallet_address = NULL, claim_tx_hash = NULL WHERE fid = $1 AND module_id = ANY($2::text[]) AND claim_tx_hash = $3',
        [fid, modules, txHash, 'earned']
      );
      return NextResponse.json({ ok: false, error: 'The token transfer did not succeed. Your verified rewards are available to retry.' }, { status: 502 });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [fid]);
      await client.query(
        'UPDATE hh2_reward_events SET status = $4, claimed_at = NOW() WHERE fid = $1 AND module_id = ANY($2::text[]) AND claim_tx_hash = $3 AND status = $5',
        [fid, modules, txHash, 'claimed', 'pending']
      );
      for (const moduleId of modules) {
        await client.query(
          'INSERT INTO hh2_claims (fid, module_id, wallet_address, tx_hash, amount) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (fid, module_id) DO NOTHING',
          [fid, moduleId, walletAddress.toLowerCase(), txHash, HH2_PER_MODULE]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    return NextResponse.json({ ok: true, claimed: modules.length, amount: modules.length * HH2_PER_MODULE, txHash });
  } catch (error: any) {
    // If no transaction hash was returned, the transfer was not accepted by the RPC.
    // Release reservations so the verified rewards remain claimable.
    try {
      await db.query(
        'UPDATE hh2_reward_events SET status = $3, wallet_address = NULL, claim_tx_hash = NULL WHERE fid = $1 AND module_id = ANY($2::text[]) AND status = $4 AND claim_tx_hash IS NULL',
        [fid, modules, 'earned', 'pending']
      );
    } catch {}
    console.error('[claim-hh2] POST error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to claim verified HH2 rewards' }, { status: 500 });
  }
}
