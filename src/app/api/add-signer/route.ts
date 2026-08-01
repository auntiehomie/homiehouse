import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { optimism } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const KEY_REGISTRY = '0x00000000Fc1237824fb747aBDE0FF18990E59b7e' as const;
const OP_RPC = process.env.OP_RPC_URL || 'https://mainnet.optimism.io';

const keyRegistryAbi = parseAbi([
  'function addFor(address fidOwner, uint32 keyType, bytes key, uint32 metadataType, bytes metadata, uint256 deadline, bytes sig) external',
]);

const publicClient = createPublicClient({ chain: optimism, transport: http(OP_RPC) });

/**
 * POST /api/add-signer
 * Registers a Farcaster Ed25519 signer key on-chain directly via KeyRegistry.addFor().
 * Server wallet pays gas — user's custody address signs the Add EIP-712 message.
 * Used by the recovery-phrase path to bypass Warpcast approval entirely.
 */
export async function POST(req: NextRequest) {
  const APP_WALLET_PRIVATE_KEY = process.env.APP_WALLET_PRIVATE_KEY as `0x${string}` | undefined;
  if (!APP_WALLET_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Server wallet not configured' }, { status: 500 });
  }

  const { fidOwner, signerPublicKey, signedKeyRequestMetadata, keyAddSig, keyAddDeadline } = await req.json();

  if (!fidOwner || !signerPublicKey || !signedKeyRequestMetadata || !keyAddSig || !keyAddDeadline) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const account = privateKeyToAccount(APP_WALLET_PRIVATE_KEY);
  const walletClient = createWalletClient({ account, chain: optimism, transport: http(OP_RPC) });

  try {

    // Rate limit: 30 requests/minute per IP
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`add-signer:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    const txHash = await walletClient.writeContract({
      address: KEY_REGISTRY,
      abi: keyRegistryAbi,
      functionName: 'addFor',
      args: [
        fidOwner as `0x${string}`,
        1,
        signerPublicKey as `0x${string}`,
        1,
        signedKeyRequestMetadata as `0x${string}`,
        BigInt(keyAddDeadline),
        keyAddSig as `0x${string}`,
      ],
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
