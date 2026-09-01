import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { createWalletClient, http, parseUnits, isAddress } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { sql } from '@/lib/db';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { createApiLogger } from '@/lib/logger';

const logger = createApiLogger('/claim-hh2');

const HH2_CONTRACT = '0x290bf43aa0406DFd0D878367814Dffa926e9Bb07' as const;
const HH2_PER_MODULE = 100;
const HH2_DECIMALS = 18;

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'to', type: 'address' as const },
      { name: 'amount', type: 'uint256' as const },
    ],
    outputs: [{ name: '', type: 'bool' as const }],
  },
];

function getTreasuryAccount() {
  const key = process.env.TREASURY_PRIVATE_KEY;
  if (!key) throw new Error('TREASURY_PRIVATE_KEY is not configured');
  const hex = (key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`;
  return privateKeyToAccount(hex);
}

// GET /api/claim-hh2?fid=123 — check how much HH2 is claimable
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userFid = Number(searchParams.get('fid'));
  if (!userFid || isNaN(userFid)) {
    return NextResponse.json({ ok: false, error: 'fid required' }, { status: 400 });
  }

  try {

    // Rate limit: 30 requests/minute per IP
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`claim-hh2:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    const [progressRows, claimedRows] = await Promise.all([
      sql`SELECT completed_ids FROM learning_progress WHERE fid = ${userFid}`,
      sql`SELECT module_id, tx_hash, claimed_at FROM hh2_claims WHERE fid = ${userFid}`,
    ]);

    const completedIds: string[] = progressRows[0]?.completed_ids ?? [];
    const claimedIds = new Set(claimedRows.map((r: any) => r.module_id));
    const unclaimedCount = completedIds.filter(id => !claimedIds.has(id)).length;

    return NextResponse.json({
      ok: true,
      claimable: unclaimedCount * HH2_PER_MODULE,
      claimableModules: unclaimedCount,
      totalClaimed: claimedRows.length * HH2_PER_MODULE,
      claims: claimedRows,
    });
  } catch (err: any) {
    logger.error('GET error', err?.message);
    return NextResponse.json({ ok: false, error: 'Failed to check claimable HH2' }, { status: 500 });
  }
}

// POST /api/claim-hh2 — send all unclaimed HH2 to a wallet in one transaction
export async function POST(req: NextRequest) {
  try {
    // Verify auth via signer key headers
    const authFid = await verifyFarcasterSignerAuth(req);

    const { fid, walletAddress } = await req.json();

    const userFid = Number(fid);
    if (!userFid || isNaN(userFid)) {
      return NextResponse.json({ ok: false, error: 'Invalid fid' }, { status: 400 });
    }
    if (!walletAddress || !isAddress(walletAddress)) {
      return NextResponse.json({ ok: false, error: 'Invalid wallet address' }, { status: 400 });
    }

    // Verify the authenticated FID matches the request
    if (authFid !== userFid) {
      return NextResponse.json(
        { ok: false, error: 'FID does not match authenticated user' },
        { status: 403 }
      );
    }

    // Find completed modules for this FID
    const progressRows = await sql`
      SELECT completed_ids FROM learning_progress WHERE fid = ${userFid}
    `;
    const completedIds: string[] = progressRows[0]?.completed_ids ?? [];
    if (completedIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'No completed modules found' }, { status: 400 });
    }

    // Find unclaimed modules
    const claimedRows = await sql`SELECT module_id FROM hh2_claims WHERE fid = ${userFid}`;
    const claimedIds = new Set(claimedRows.map((r: any) => r.module_id));
    const unclaimedIds = completedIds.filter(id => !claimedIds.has(id));

    if (unclaimedIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Nothing to claim — all modules already claimed' }, { status: 400 });
    }

    const totalHH2 = unclaimedIds.length * HH2_PER_MODULE;
    const amount = parseUnits(String(totalHH2), HH2_DECIMALS);

    // Send one batched ERC-20 transfer for all unclaimed modules
    const account = getTreasuryAccount();
    const client = createWalletClient({
      account,
      chain: base,
      transport: http(),
    });

    const txHash = await client.writeContract({
      address: HH2_CONTRACT,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [walletAddress as `0x${string}`, amount],
    });

    // Record each module as claimed (ON CONFLICT DO NOTHING = safe to retry)
    for (const moduleId of unclaimedIds) {
      await sql`
        INSERT INTO hh2_claims (fid, module_id, wallet_address, tx_hash, amount)
        VALUES (${userFid}, ${moduleId}, ${walletAddress.toLowerCase()}, ${txHash}, ${HH2_PER_MODULE})
        ON CONFLICT (fid, module_id) DO NOTHING
      `;
    }

    return NextResponse.json({ ok: true, claimed: unclaimedIds.length, amount: totalHH2, txHash });
  } catch (err: any) {
    logger.error('POST error', err?.message);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to claim HH2' },
      { status: 500 }
    );
  }
}
