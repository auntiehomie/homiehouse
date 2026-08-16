import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { optimism } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const KEY_REGISTRY = '0x00000000Fc1237824fb747aBDE0FF18990E59b7e' as const;
const ID_REGISTRY = '0x00000000fc6c5f01fc30151999387bb99a9f489b' as const;
const OP_RPC = process.env.OP_RPC_URL || 'https://mainnet.optimism.io';

const keyRegistryAbi = parseAbi([
  'function addFor(address fidOwner, uint32 keyType, bytes key, uint32 metadataType, bytes metadata, uint256 deadline, bytes sig) external',
]);

const idRegistryAbi = parseAbi([
  'function custodyOf(uint256 fid) view returns (address)',
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

  const { fidOwner, signerPublicKey, signedKeyRequestMetadata, keyAddSig, keyAddDeadline, fid } = await req.json();

  if (!fidOwner || !signerPublicKey || !signedKeyRequestMetadata || !keyAddSig || !keyAddDeadline) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Rate limit: 30 requests/minute per IP
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  const { success: rateLimitOk } = rateLimit(`add-signer:${ip}`, 30, 60);
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  // Server-side custody check: if the client sends the FID (new client code),
  // verify the fidOwner matches the on-chain custody address before attempting
  // the gas-paying transaction. This catches Warpcast-managed accounts early.
  if (fid) {
    try {
      const onChainCustody = await publicClient.readContract({
        address: ID_REGISTRY,
        abi: idRegistryAbi,
        functionName: 'custodyOf',
        args: [BigInt(fid)],
      });
      if (onChainCustody.toLowerCase() !== (fidOwner as string).toLowerCase()) {
        return NextResponse.json(
          {
            error:
              'This recovery phrase does not match the custody wallet for your FID. ' +
              'Your account is likely managed by Warpcast. Use "Enable Posting" on the ' +
              'Compose page instead — it works with Warpcast-managed accounts.',
          },
          { status: 400 },
        );
      }
    } catch {
      // If custody lookup fails, continue — the addFor call will handle it
    }
  }

  const account = privateKeyToAccount(APP_WALLET_PRIVATE_KEY);
  const walletClient = createWalletClient({ account, chain: optimism, transport: http(OP_RPC) });

  try {
    // Simulate first to catch reverts without spending gas
    try {
      await publicClient.simulateContract({
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
    } catch (simErr: any) {
      // The simulation reverted — most common cause is custody mismatch
      // (recovery phrase doesn't derive to the on-chain custody address).
      // This happens with Warpcast-managed accounts.
      console.error('add-signer simulation reverted:', simErr.shortMessage || simErr.message);
      return NextResponse.json(
        {
          error:
            'This recovery phrase does not match the custody wallet for your FID. ' +
            'Your account is likely managed by Warpcast. Use "Enable Posting" on the ' +
            'Compose page instead — it works with Warpcast-managed accounts.',
        },
        { status: 400 },
      );
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
