import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi } from 'viem';
import { optimism } from 'viem/chains';
import { rateLimit } from '@/lib/ratelimit';

// IDRegistry on Optimism mainnet
const ID_REGISTRY = '0x00000000fc6c5f01fc30151999387bb99a9f489b' as const;
const OP_RPC = process.env.OP_RPC_URL || 'https://mainnet.optimism.io';

const idRegistryAbi = parseAbi([
  'function custodyOf(uint256 fid) view returns (address)',
]);

const publicClient = createPublicClient({
  chain: optimism,
  transport: http(OP_RPC),
});

/**
 * GET /api/custody-address?fid=12345
 * Returns the on-chain custody address that owns a given FID.
 */
export async function GET(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  const { success: rateLimitOk } = rateLimit(`custody-addr:${ip}`, 30, 60);
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const fidParam = searchParams.get('fid');

  if (!fidParam) {
    return NextResponse.json({ error: 'fid parameter required' }, { status: 400 });
  }

  const fid = parseInt(fidParam, 10);
  if (isNaN(fid) || fid <= 0) {
    return NextResponse.json({ error: 'Invalid FID' }, { status: 400 });
  }

  try {
    const custodyAddress = await publicClient.readContract({
      address: ID_REGISTRY,
      abi: idRegistryAbi,
      functionName: 'custodyOf',
      args: [BigInt(fid)],
    });

    return NextResponse.json(
      { fid, custodyAddress },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (err: any) {
    console.error('custody-address error:', err.shortMessage || err.message);
    return NextResponse.json(
      { error: err.shortMessage || err.message || 'Failed to fetch custody address' },
      { status: 500 },
    );
  }
}
