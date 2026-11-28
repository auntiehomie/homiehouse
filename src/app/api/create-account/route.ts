import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';
import { AuthError } from '@/lib/errors';
import {
  createPublicClient,
  http,
  parseAbi,
  encodeAbiParameters,
  recoverTypedDataAddress,
} from 'viem';
import { optimism } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';
import { HypersnapUnavailableError } from '@/lib/hypersnap-nodes';
import {
  encodeNativeOnboardMessage,
  getNativeAccountByCustody,
  getNativeRegistrationInfo,
  mineRegistrationPow,
  nativeOnboardTypedData,
  PowTimeoutError,
  submitNativeOnboard,
  verifyNativeOnboardPow,
  type NativeOnboardProof,
} from '@/lib/hypersnap-native';

// Mining the registration proof takes a few seconds of CPU on the server.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ── Legacy Farcaster contracts (signer metadata for existing Optimism FIDs only) ──
const ID_GATEWAY    = '0x00000000Fc25870C6eD6b6c7E41Fb078b7656f69' as const;
const ID_REGISTRY   = '0x00000000fc6c5f01fc30151999387bb99a9f489b' as const;
const KEY_REGISTRY  = '0x00000000Fc1237824fb747aBDE0FF18990E59b7e' as const;
const SKR_VALIDATOR = '0x00000000fc700472606ed4fa22623acf62c60553' as const;
const OP_RPC        = process.env.OP_RPC_URL || 'https://mainnet.optimism.io';

const idGatewayAbi = parseAbi([
  'function price(uint256 extraStorage) view returns (uint256)',
]);
const idRegistryAbi = parseAbi([
  'function nonces(address owner) view returns (uint256)',
]);
const keyRegistryAbi = parseAbi([
  'function nonces(address owner) view returns (uint256)',
]);

const publicClient = createPublicClient({
  chain: optimism,
  transport: http(OP_RPC),
});

// ── Registration limits ─────────────────────────────────────────────────────
// Native registration costs no gas, but each prepare spends server CPU on the
// proof of work and each account is permanent, so both steps are limited and
// fail closed when the shared store is unavailable.
const DAY_SECONDS = 24 * 60 * 60;
const HOUR_SECONDS = 60 * 60;
/** Proof-of-work preparations allowed per IP per hour. */
const PREPARE_PER_IP_PER_HOUR = 6;
/** Registrations allowed per IP per day. */
const PER_IP_PER_DAY = 3;
/** Registrations allowed across all callers per day (override with CREATE_ACCOUNT_DAILY_CAP). */
const DEFAULT_GLOBAL_DAILY_CAP = 20;
/** Time allowed for registration to show up on shard 0 before answering "pending". */
const INCLUSION_WAIT_MS = 20_000;

function globalDailyCap(): number {
  const configured = Number(process.env.CREATE_ACCOUNT_DAILY_CAP);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_GLOBAL_DAILY_CAP;
}

function registrationDisabled(): boolean {
  return /^(1|true|yes)$/i.test(process.env.SPONSORED_REGISTRATION_DISABLED?.trim() ?? '');
}

function isHex(value: unknown, bytes?: number): value is `0x${string}` {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(value)) return false;
  return bytes === undefined || value.length === 2 + bytes * 2;
}

/** Consume one unit from a distributed limit; null means allowed. */
async function consume(key: string, limit: number, windowSeconds: number, message: string): Promise<NextResponse | null> {
  try {
    const { success } = await checkRateLimit(key, limit, windowSeconds);
    if (success) return null;
    return NextResponse.json({ error: message }, { status: 429 });
  } catch (error) {
    if (error instanceof AuthError) {
      console.error('[create-account] rate limit store unavailable:', error.message);
      return NextResponse.json(
        { error: 'Account creation is temporarily unavailable. Try again later.' },
        { status: 503 },
      );
    }
    throw error;
  }
}

function pausedResponse() {
  return NextResponse.json(
    { error: 'New account creation is paused right now. Try again later.' },
    { status: 503 },
  );
}

function errorResponse(err: unknown, fallback: string) {
  if (err instanceof HypersnapUnavailableError || err instanceof PowTimeoutError) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 });
  }
  console.error('[create-account]', fallback, err);
  return NextResponse.json({ error: (err as any)?.message || fallback }, { status: 500 });
}

// ── GET ─────────────────────────────────────────────────────────────────────
//   ?lookup=0x…                         → the native FID this wallet already has, if any
//   ?address=0x…                        → native registration proof + typed data to sign
//   ?address=0x…&signerKey=…&deadline=… → legacy KeyRegistry signer metadata (Optimism FIDs)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const lookup = searchParams.get('lookup');
  if (lookup !== null) {
    if (!isHex(lookup, 20)) return NextResponse.json({ error: 'A 20-byte wallet address is required' }, { status: 400 });
    try {
      const account = await getNativeAccountByCustody(lookup);
      return NextResponse.json({ fid: account?.fid ?? null });
    } catch (err) {
      return errorResponse(err, 'Failed to look up native account');
    }
  }

  const address   = searchParams.get('address')   as `0x${string}` | null;
  const signerKey = searchParams.get('signerKey')  as `0x${string}` | null;
  const deadline  = searchParams.get('deadline');

  if (!address || (!!signerKey !== !!deadline)) {
    return NextResponse.json({ error: 'address is required; signerKey and deadline must be supplied together for legacy signer metadata' }, { status: 400 });
  }

  if (!signerKey || !deadline) return prepareNativeRegistration(req, address);
  return legacySignerMetadata(address, signerKey, deadline);
}

async function prepareNativeRegistration(req: NextRequest, address: `0x${string}`) {
  if (!isHex(address, 20)) return NextResponse.json({ error: 'A 20-byte wallet address is required' }, { status: 400 });
  if (registrationDisabled()) return pausedResponse();

  try {
    const existing = await getNativeAccountByCustody(address);
    if (existing) return NextResponse.json({ existingFid: existing.fid });

    const limited = await consume(
      `create-account:prepare:${rateLimitKeyFromRequest(req)}`, PREPARE_PER_IP_PER_HOUR, HOUR_SECONDS,
      'Too many account setup attempts from this network. Try again in an hour.',
    );
    if (limited) return limited;

    const info = await getNativeRegistrationInfo();
    if (!info.active) {
      return NextResponse.json({ error: 'Hypersnap is not accepting new accounts right now.' }, { status: 503 });
    }
    const custody = Buffer.from(address.slice(2), 'hex');
    const anchor = Buffer.from(info.anchorBlockHash.slice(2), 'hex');
    const nonce = mineRegistrationPow(custody, anchor, info.minDifficultyBits);
    const proof: NativeOnboardProof = {
      custodyAddress: address.toLowerCase() as `0x${string}`,
      anchorBlockHeight: info.anchorBlockHeight,
      anchorBlockHash: info.anchorBlockHash.toLowerCase() as `0x${string}`,
      nonce: `0x${nonce.toString('hex')}`,
      difficultyBits: info.minDifficultyBits,
    };
    const typed = nativeOnboardTypedData(proof);
    return NextResponse.json({
      proof,
      typedData: {
        domain: typed.domain,
        types: typed.types,
        primaryType: typed.primaryType,
        message: { ...typed.message, anchor_block_height: String(proof.anchorBlockHeight) },
      },
    });
  } catch (err) {
    return errorResponse(err, 'Failed to prepare registration');
  }
}

async function legacySignerMetadata(address: `0x${string}`, signerKey: `0x${string}`, deadline: string) {
  const APP_MNEMONIC = process.env.APP_MNEMONIC;
  const APP_FID      = process.env.APP_FID;
  if (!APP_MNEMONIC || !APP_FID) {
    return NextResponse.json({ error: 'Legacy signer metadata configuration is incomplete' }, { status: 500 });
  }

  try {
    const deadlineBn = BigInt(deadline);
    const appFid     = BigInt(APP_FID);
    const cleanMnemonic = APP_MNEMONIC.trim().replace(/^["']|["']$/g, '');
    const appAccount = mnemonicToAccount(cleanMnemonic as `${string}`);

    // Fetch nonces + price in parallel
    const [registerNonce, keyAddNonce, price] = await Promise.all([
      publicClient.readContract({ address: ID_REGISTRY, abi: idRegistryAbi, functionName: 'nonces', args: [address] }),
      publicClient.readContract({ address: KEY_REGISTRY, abi: keyRegistryAbi, functionName: 'nonces', args: [address] }),
      publicClient.readContract({ address: ID_GATEWAY,  abi: idGatewayAbi,  functionName: 'price',  args: [0n] }),
    ]);

    // APP FID signs the SignedKeyRequest (authorises this signer key)
    const signedKeyRequestSig = await appAccount.signTypedData({
      domain: {
        name: 'Farcaster SignedKeyRequestValidator',
        version: '1',
        chainId: 10,
        verifyingContract: SKR_VALIDATOR,
      },
      types: {
        SignedKeyRequest: [
          { name: 'requestFid', type: 'uint256' },
          { name: 'key',        type: 'bytes'   },
          { name: 'deadline',   type: 'uint256' },
        ],
      },
      primaryType: 'SignedKeyRequest',
      message: { requestFid: appFid, key: signerKey, deadline: deadlineBn },
    });

    // ABI-encode SignedKeyRequestMetadata as a TUPLE — validator does
    // abi.decode(metadata, (SignedKeyRequestMetadata)) which needs the 0x20 wrapper.
    const signedKeyRequestMetadata = encodeAbiParameters(
      [{ type: 'tuple', components: [
        { name: 'requestFid',    type: 'uint256' },
        { name: 'requestSigner', type: 'address' },
        { name: 'signature',     type: 'bytes'   },
        { name: 'deadline',      type: 'uint256' },
      ]}],
      [{ requestFid: appFid, requestSigner: appAccount.address, signature: signedKeyRequestSig, deadline: deadlineBn }],
    );

    return NextResponse.json({
      registerNonce:           registerNonce.toString(),
      keyAddNonce:             keyAddNonce.toString(),
      price:                   price.toString(),
      signedKeyRequestMetadata,
    });
  } catch (err: any) {
    console.error('create-account GET error:', err);
    return NextResponse.json({ error: err.message || 'Failed to prepare registration' }, { status: 500 });
  }
}

// ── POST — submit a native Hypersnap registration ───────────────────────────
// Body: { proof: NativeOnboardProof, custodySignature }. No gas is spent.
export async function POST(req: NextRequest) {
  if (registrationDisabled()) return pausedResponse();

  // Browser-only flow: reject cross-site and scripted requests without a matching Origin.
  const origin = req.headers.get('origin');
  if (!origin || origin !== new URL(req.url).origin) {
    return NextResponse.json({ error: 'Cross-origin account creation is not allowed.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const proof = body?.proof ?? {};
  const custodySignature = body?.custodySignature;
  if (
    !isHex(proof.custodyAddress, 20)
    || !isHex(proof.anchorBlockHash, 32)
    || !isHex(proof.nonce)
    || proof.nonce.length > 2 + 64 * 2
    || !Number.isSafeInteger(proof.anchorBlockHeight) || proof.anchorBlockHeight < 0
    || !Number.isInteger(proof.difficultyBits) || proof.difficultyBits < 1 || proof.difficultyBits > 40
    || !isHex(custodySignature, 65)
  ) {
    return NextResponse.json({ error: 'Invalid account creation request' }, { status: 400 });
  }
  const cleanProof: NativeOnboardProof = {
    custodyAddress: proof.custodyAddress.toLowerCase(),
    anchorBlockHeight: proof.anchorBlockHeight,
    anchorBlockHash: proof.anchorBlockHash.toLowerCase(),
    nonce: proof.nonce.toLowerCase(),
    difficultyBits: proof.difficultyBits,
  };

  // Cheap local checks before touching the node or the daily budget.
  if (!verifyNativeOnboardPow(cleanProof)) {
    return NextResponse.json({ error: 'Registration proof is invalid. Please start again.' }, { status: 400 });
  }
  try {
    const signer = await recoverTypedDataAddress({ ...nativeOnboardTypedData(cleanProof), signature: custodySignature });
    if (signer.toLowerCase() !== cleanProof.custodyAddress) {
      return NextResponse.json({ error: 'The wallet signature does not match this wallet. Please try again.' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'The wallet signature could not be verified.' }, { status: 400 });
  }

  const ipLimited = await consume(
    `create-account:post:${rateLimitKeyFromRequest(req)}`, PER_IP_PER_DAY, DAY_SECONDS,
    'Too many accounts created from this network today. Try again tomorrow.',
  );
  if (ipLimited) return ipLimited;

  try {
    const existing = await getNativeAccountByCustody(cleanProof.custodyAddress);
    if (existing) return NextResponse.json({ ok: true, fid: existing.fid, native: true, alreadyRegistered: true });

    const globalLimited = await consume(
      'create-account:post:global', globalDailyCap(), DAY_SECONDS,
      'HomieHouse has reached today\'s limit for new accounts. Try again tomorrow.',
    );
    if (globalLimited) return globalLimited;

    const { messageBytes, hash } = encodeNativeOnboardMessage({ ...cleanProof, custodySignature });
    const submitted = await submitNativeOnboard(messageBytes);
    if (!submitted.ok && !/duplicate|already/i.test(submitted.error ?? '')) {
      const expired = /anchor/i.test(submitted.error ?? '');
      return NextResponse.json(
        { error: expired ? 'The registration took too long and expired. Please start again.' : (submitted.error || 'Hypersnap rejected the registration.'), retry: expired },
        { status: submitted.status >= 500 ? 502 : 400 },
      );
    }

    // Shard 0 assigns the FID when the next block includes the registration.
    const waitUntil = Date.now() + INCLUSION_WAIT_MS;
    while (Date.now() < waitUntil) {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      const account = await getNativeAccountByCustody(cleanProof.custodyAddress).catch(() => null);
      if (account) {
        return NextResponse.json({ ok: true, fid: account.fid, native: true, hash: `0x${Buffer.from(hash).toString('hex')}` });
      }
    }
    return NextResponse.json({ ok: true, fid: null, pending: true, native: true, hash: `0x${Buffer.from(hash).toString('hex')}` }, { status: 202 });
  } catch (err) {
    return errorResponse(err, 'Registration failed');
  }
}
