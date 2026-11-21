import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';
import { AuthError } from '@/lib/errors';
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { optimism } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const KEY_REGISTRY = '0x00000000Fc1237824fb747aBDE0FF18990E59b7e' as const;
const ID_REGISTRY = '0x00000000fc6c5f01fc30151999387bb99a9f489b' as const;
const OP_RPC = process.env.OP_RPC_URL || 'https://mainnet.optimism.io';

/** Gas-paying registrations allowed per IP per hour. */
const PER_IP_PER_HOUR = 10;
/** Gas-paying registrations allowed per FID per day. */
const PER_FID_PER_DAY = 3;
/** Gas-paying registrations allowed across all callers per day (override with ADD_SIGNER_DAILY_CAP). */
const DEFAULT_GLOBAL_DAILY_CAP = 50;
const DAY_SECONDS = 24 * 60 * 60;

const keyRegistryAbi = parseAbi([
  'function addFor(address fidOwner, uint32 keyType, bytes key, uint32 metadataType, bytes metadata, uint256 deadline, bytes sig) external',
]);

const idRegistryAbi = parseAbi([
  'function custodyOf(uint256 fid) view returns (address)',
]);

const publicClient = createPublicClient({ chain: optimism, transport: http(OP_RPC) });

const CUSTODY_MISMATCH_MESSAGE =
  'This recovery phrase does not match the custody wallet for your FID. ' +
  'Your account is likely managed by Warpcast. Use "Enable Posting" on the ' +
  'Compose page instead — it works with Warpcast-managed accounts.';

function isHex(value: unknown, bytes?: number): value is `0x${string}` {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(value)) return false;
  return bytes === undefined || value.length === 2 + bytes * 2;
}

function globalDailyCap(): number {
  const configured = Number(process.env.ADD_SIGNER_DAILY_CAP);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_GLOBAL_DAILY_CAP;
}

/**
 * Consume one unit from a distributed (Upstash) limit. Fails closed: if the
 * shared store is unavailable in production, the request is refused, because
 * this route spends the app wallet's gas.
 */
async function consume(key: string, limit: number, windowSeconds: number): Promise<NextResponse | null> {
  try {
    const { success } = await checkRateLimit(key, limit, windowSeconds);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many signer registrations. Try again later.' },
        { status: 429 },
      );
    }
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      console.error('[add-signer] rate limit store unavailable:', error.message);
      return NextResponse.json(
        { error: 'Signer registration is temporarily unavailable. Try again later.' },
        { status: 503 },
      );
    }
    throw error;
  }
}

/**
 * POST /api/add-signer
 * Registers a Farcaster Ed25519 signer key on-chain directly via KeyRegistry.addFor().
 * Server wallet pays gas — user's custody address signs the Add EIP-712 message.
 * Used by the recovery-phrase path to bypass Warpcast approval entirely.
 *
 * Because the server pays gas and the caller has no session yet, abuse is
 * bounded by: a required FID whose on-chain custody must match `fidOwner`
 * (fail closed), a successful simulation, and distributed per-IP, per-FID and
 * global daily limits.
 */
export async function POST(req: NextRequest) {
  const APP_WALLET_PRIVATE_KEY = process.env.APP_WALLET_PRIVATE_KEY as `0x${string}` | undefined;
  if (!APP_WALLET_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Server wallet not configured' }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const { fidOwner, signerPublicKey, signedKeyRequestMetadata, keyAddSig, keyAddDeadline } = body ?? {};
  const fid = Number(body?.fid);

  if (!fidOwner || !signerPublicKey || !signedKeyRequestMetadata || !keyAddSig || !keyAddDeadline) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!Number.isSafeInteger(fid) || fid <= 0) {
    return NextResponse.json({ error: 'A valid fid is required' }, { status: 400 });
  }
  if (
    !isHex(fidOwner, 20)
    || !isHex(signerPublicKey, 32)
    || !isHex(signedKeyRequestMetadata)
    || !isHex(keyAddSig)
    || !/^\d{1,20}$/.test(String(keyAddDeadline))
  ) {
    return NextResponse.json({ error: 'Invalid signer registration payload' }, { status: 400 });
  }

  // Cheap per-IP limit before any RPC work.
  const ipLimited = await consume(`add-signer:${rateLimitKeyFromRequest(req)}`, PER_IP_PER_HOUR, 60 * 60);
  if (ipLimited) return ipLimited;

  // Mandatory custody check: the address that signed the Add message must be
  // the FID's current custody address. Fail closed if the lookup fails.
  let onChainCustody: string;
  try {
    onChainCustody = await publicClient.readContract({
      address: ID_REGISTRY,
      abi: idRegistryAbi,
      functionName: 'custodyOf',
      args: [BigInt(fid)],
    });
  } catch (error) {
    console.error('[add-signer] custody lookup failed:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Could not verify custody for this FID. Try again later.' },
      { status: 503 },
    );
  }
  if (onChainCustody.toLowerCase() !== fidOwner.toLowerCase()) {
    return NextResponse.json({ error: CUSTODY_MISMATCH_MESSAGE }, { status: 400 });
  }

  const args = [
    fidOwner,
    1,
    signerPublicKey,
    1,
    signedKeyRequestMetadata,
    BigInt(keyAddDeadline),
    keyAddSig,
  ] as const;

  try {
    // Simulate first to catch reverts (bad signature, expired deadline,
    // duplicate key) without spending gas or consuming per-FID quota.
    try {
      await publicClient.simulateContract({
        address: KEY_REGISTRY,
        abi: keyRegistryAbi,
        functionName: 'addFor',
        args,
      });
    } catch (simErr: any) {
      const fullErr = simErr?.cause?.data || simErr?.cause?.reason || simErr?.data || simErr?.reason;
      const shortMsg = simErr?.shortMessage || simErr?.message || 'Unknown revert';
      console.error('add-signer simulation reverted:', { shortMsg, fullErr, causeMsg: simErr?.cause?.message });
      return NextResponse.json(
        { error: `Signer registration failed: ${fullErr || shortMsg}` },
        { status: 400 },
      );
    }

    // Only a transaction that will actually be sent consumes the per-FID and
    // global budgets.
    const fidLimited = await consume(`add-signer:fid:${fid}`, PER_FID_PER_DAY, DAY_SECONDS);
    if (fidLimited) return fidLimited;
    const globalLimited = await consume('add-signer:global', globalDailyCap(), DAY_SECONDS);
    if (globalLimited) {
      console.error('[add-signer] global daily cap reached; refusing gas-paying registrations');
      return globalLimited;
    }

    const account = privateKeyToAccount(APP_WALLET_PRIVATE_KEY);
    const walletClient = createWalletClient({ account, chain: optimism, transport: http(OP_RPC) });
    const txHash = await walletClient.writeContract({
      address: KEY_REGISTRY,
      abi: keyRegistryAbi,
      functionName: 'addFor',
      args,
    });

    return NextResponse.json({ ok: true, txHash });
  } catch (err: any) {
    console.error('add-signer error:', err.shortMessage || err.message);
    return NextResponse.json(
      { error: err.shortMessage || err.message || 'Failed to register signer' },
      { status: 500 },
    );
  }
}
