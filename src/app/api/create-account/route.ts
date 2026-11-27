import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';
import { AuthError } from '@/lib/errors';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodeAbiParameters,
  decodeEventLog,
} from 'viem';
import { optimism } from 'viem/chains';
import { privateKeyToAccount, mnemonicToAccount } from 'viem/accounts';

// ── Farcaster contract addresses on Optimism mainnet ─────────────────────────
const ID_GATEWAY    = '0x00000000Fc25870C6eD6b6c7E41Fb078b7656f69' as const;
const ID_REGISTRY   = '0x00000000fc6c5f01fc30151999387bb99a9f489b' as const;
const KEY_REGISTRY  = '0x00000000Fc1237824fb747aBDE0FF18990E59b7e' as const;
const SKR_VALIDATOR = '0x00000000fc700472606ed4fa22623acf62c60553' as const;
const FNAME_API     = 'https://fnames.farcaster.xyz/transfers';
const OP_RPC        = process.env.OP_RPC_URL || 'https://mainnet.optimism.io';

// ── ABIs ──────────────────────────────────────────────────────────────────────
const idGatewayAbi = parseAbi([
  'function price(uint256 extraStorage) view returns (uint256)',
  'function registerFor(address to, address recovery, uint256 deadline, bytes sig, uint256 extraStorage) payable returns (uint256 fid, uint256 overpayment)',
]);

const idRegistryAbi = parseAbi([
  'function nonces(address owner) view returns (uint256)',
  'event Register(address indexed to, uint256 indexed id, address recovery)',
]);

const keyRegistryAbi = parseAbi([
  'function nonces(address owner) view returns (uint256)',
  'function addFor(address fidOwner, uint32 keyType, bytes key, uint32 metadataType, bytes metadata, uint256 deadline, bytes sig) external',
]);

const publicClient = createPublicClient({
  chain: optimism,
  transport: http(OP_RPC),
});

// ── Sponsored-registration limits ────────────────────────────────────────────
// POST spends the app wallet (APP_WALLET_PRIVATE_KEY) on IdGateway.registerFor.
// The caller has no session yet, so spend is bounded by distributed limits that
// fail closed when the shared store is unavailable.
const DAY_SECONDS = 24 * 60 * 60;
/** Sponsored registrations allowed per IP per day. */
const PER_IP_PER_DAY = 3;
/** Sponsored registrations allowed across all callers per day (override with CREATE_ACCOUNT_DAILY_CAP). */
const DEFAULT_GLOBAL_DAILY_CAP = 20;

function globalDailyCap(): number {
  const configured = Number(process.env.CREATE_ACCOUNT_DAILY_CAP);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_GLOBAL_DAILY_CAP;
}

function sponsoredRegistrationDisabled(): boolean {
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

// ── GET — nonces + price + pre-signed metadata (or fname availability check) ─
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // fname availability sub-route
  const checkFname = searchParams.get('checkFname');
  if (checkFname) {
    try {

    // Rate limit: 30 requests/minute per IP
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = await rateLimit(`create-account:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
      const res = await fetch(`${FNAME_API}?name=${encodeURIComponent(checkFname)}`);
      if (!res.ok) return NextResponse.json({ available: false });
      const data = await res.json();
      const transfers: any[] = data.transfers || [];
      const available = transfers.length === 0 || transfers[transfers.length - 1]?.to === 0;
      return NextResponse.json({ available });
    } catch {
      return NextResponse.json({ available: false });
    }
  }

  const address   = searchParams.get('address')   as `0x${string}` | null;
  const signerKey = searchParams.get('signerKey')  as `0x${string}` | null;
  const deadline  = searchParams.get('deadline');

  if (!address || (!!signerKey !== !!deadline)) {
    return NextResponse.json({ error: 'address is required; signerKey and deadline must be supplied together for legacy signer metadata' }, { status: 400 });
  }

  const APP_MNEMONIC          = process.env.APP_MNEMONIC;
  const APP_FID               = process.env.APP_FID;
  const APP_WALLET_PRIVATE_KEY = process.env.APP_WALLET_PRIVATE_KEY as `0x${string}` | undefined;

  if (!APP_WALLET_PRIVATE_KEY || (signerKey && (!APP_MNEMONIC || !APP_FID))) {
    return NextResponse.json({ error: 'Server configuration incomplete' }, { status: 500 });
  }

  try {
    if (!signerKey || !deadline) {
      const [registerNonce, price] = await Promise.all([
        publicClient.readContract({ address: ID_REGISTRY, abi: idRegistryAbi, functionName: 'nonces', args: [address] }),
        publicClient.readContract({ address: ID_GATEWAY, abi: idGatewayAbi, functionName: 'price', args: [0n] }),
      ]);
      return NextResponse.json({ registerNonce: registerNonce.toString(), price: price.toString() });
    }

    if (!APP_MNEMONIC || !APP_FID) {
      return NextResponse.json({ error: 'Legacy signer metadata configuration is incomplete' }, { status: 500 });
    }

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

// ── POST — execute on-chain registration ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const APP_WALLET_PRIVATE_KEY = process.env.APP_WALLET_PRIVATE_KEY as `0x${string}` | undefined;
  if (!APP_WALLET_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Server wallet not configured' }, { status: 500 });
  }
  if (sponsoredRegistrationDisabled()) {
    return NextResponse.json(
      { error: 'New account creation is paused right now. Try again later.' },
      { status: 503 },
    );
  }

  // Browser-only flow: reject cross-site and scripted requests without a matching Origin.
  const origin = req.headers.get('origin');
  if (!origin || origin !== new URL(req.url).origin) {
    return NextResponse.json({ error: 'Cross-origin account creation is not allowed.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const {
    custodyAddress,
    registerSig,
    registerDeadline,
    fnameSig,
    fnameTimestamp,
    username,
  } = body ?? {};

  if (!custodyAddress || !registerSig || !registerDeadline || !username) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1000);
  if (
    !isHex(custodyAddress, 20)
    || !isHex(registerSig, 65)
    || !/^\d{1,20}$/.test(String(registerDeadline))
    || Number(registerDeadline) <= now
    || Number(registerDeadline) > now + 2 * DAY_SECONDS
    || typeof username !== 'string'
    || !/^[a-z0-9_-]{1,16}$/.test(username)
    || (fnameSig !== undefined && fnameSig !== null && !isHex(fnameSig, 65))
  ) {
    return NextResponse.json({ error: 'Invalid account creation request' }, { status: 400 });
  }

  // Cheap per-IP limit before any RPC work.
  const ipLimited = await consume(
    `create-account:post:${rateLimitKeyFromRequest(req)}`, PER_IP_PER_DAY, DAY_SECONDS,
    'Too many accounts created from this network today. Try again tomorrow.',
  );
  if (ipLimited) return ipLimited;

  const serverAccount = privateKeyToAccount(APP_WALLET_PRIVATE_KEY);
  const walletClient  = createWalletClient({
    account: serverAccount,
    chain: optimism,
    transport: http(OP_RPC),
  });

  try {
    // ── 1. Get current price ────────────────────────────────────────────────
    const price = await publicClient.readContract({
      address: ID_GATEWAY, abi: idGatewayAbi, functionName: 'price', args: [0n],
    });

    // ── 2. Dry-run first: a bad signature or an address that already has an
    // FID reverts here and costs nothing, and does not use the daily budget.
    const registerArgs = [
      custodyAddress,
      custodyAddress, // recovery = custody
      BigInt(registerDeadline),
      registerSig,
      0n,
    ] as const;
    try {
      await publicClient.simulateContract({
        account: serverAccount,
        address: ID_GATEWAY,
        abi: idGatewayAbi,
        functionName: 'registerFor',
        args: registerArgs,
        value: price,
      });
    } catch (simErr: any) {
      return NextResponse.json(
        { error: simErr?.shortMessage || 'This registration would fail on-chain. Check your wallet signature and try again.' },
        { status: 400 },
      );
    }

    // ── 3. Global daily spend cap, consumed only by registrations that will succeed.
    const globalLimited = await consume(
      'create-account:post:global', globalDailyCap(), DAY_SECONDS,
      'HomieHouse has reached today\'s limit for new accounts. Try again tomorrow.',
    );
    if (globalLimited) return globalLimited;

    // ── 4. Register FID ─────────────────────────────────────────────────────
    const registerTxHash = await walletClient.writeContract({
      address: ID_GATEWAY,
      abi: idGatewayAbi,
      functionName: 'registerFor',
      args: registerArgs,
      value: price,
    });

    // ── 5. Wait for receipt + parse FID ─────────────────────────────────────
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: registerTxHash,
      timeout: 60_000,
    });

    let fid: number | null = null;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: idRegistryAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === 'Register') {
          fid = Number((decoded.args as any).id);
          break;
        }
      } catch {}
    }
    if (!fid) {
      return NextResponse.json({ error: 'FID not found in transaction receipt' }, { status: 500 });
    }

    // ── 6. Register fname (non-fatal if it fails) ────────────────────────────
    let fnameRegistered = false;
    if (fnameSig && fnameTimestamp && username) {
      try {
        const fnameBody = {
          name: username,
          from: 0,
          to: fid,
          fid,
          owner: custodyAddress,
          timestamp: fnameTimestamp,
          signature: fnameSig,
        };
        const fnameRes = await fetch(FNAME_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fnameBody),
        });
        fnameRegistered = fnameRes.ok;
        if (!fnameRes.ok) {
          const errText = await fnameRes.text();
          console.error('Fname registration failed:', fnameRes.status, errText.slice(0, 200));
        }
      } catch (fnameErr: any) {
        console.error('Fname POST error (non-fatal):', fnameErr.message?.slice(0, 200));
      }
    }

    return NextResponse.json({
      ok: true,
      fid,
      username,
      registerTxHash,
      signerTxHash: null,
      fnameRegistered,
    });
  } catch (err: any) {
    console.error('create-account POST error:', err);
    return NextResponse.json(
      { error: err.shortMessage || err.message || 'Registration failed' },
      { status: 500 },
    );
  }
}
