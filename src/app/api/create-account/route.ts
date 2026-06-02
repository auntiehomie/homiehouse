import { NextRequest, NextResponse } from 'next/server';
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

// ── GET — nonces + price + pre-signed metadata (or fname availability check) ─
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // fname availability sub-route
  const checkFname = searchParams.get('checkFname');
  if (checkFname) {
    try {
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

  if (!address || !signerKey || !deadline) {
    return NextResponse.json({ error: 'address, signerKey, deadline required' }, { status: 400 });
  }

  const APP_MNEMONIC          = process.env.APP_MNEMONIC;
  const APP_FID               = process.env.APP_FID;
  const APP_WALLET_PRIVATE_KEY = process.env.APP_WALLET_PRIVATE_KEY as `0x${string}` | undefined;

  if (!APP_MNEMONIC || !APP_FID || !APP_WALLET_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Server configuration incomplete' }, { status: 500 });
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

    // ABI-encode SignedKeyRequestMetadata
    const signedKeyRequestMetadata = encodeAbiParameters(
      [
        { name: 'requestFid',    type: 'uint256' },
        { name: 'requestSigner', type: 'address' },
        { name: 'signature',     type: 'bytes'   },
        { name: 'deadline',      type: 'uint256' },
      ],
      [appFid, appAccount.address, signedKeyRequestSig, deadlineBn],
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

  const body = await req.json();
  const {
    custodyAddress,
    signerPublicKey,
    signedKeyRequestMetadata,
    registerSig,
    registerDeadline,
    keyAddSig,
    keyAddDeadline,
    fnameSig,
    fnameTimestamp,
    username,
  } = body;

  if (!custodyAddress || !signerPublicKey || !registerSig || !registerDeadline || !username) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

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

    // ── 2. Register FID ─────────────────────────────────────────────────────
    const registerTxHash = await walletClient.writeContract({
      address: ID_GATEWAY,
      abi: idGatewayAbi,
      functionName: 'registerFor',
      args: [
        custodyAddress as `0x${string}`,
        custodyAddress as `0x${string}`, // recovery = custody
        BigInt(registerDeadline),
        registerSig as `0x${string}`,
        0n,
      ],
      value: price,
    });

    // ── 3. Wait for receipt + parse FID ─────────────────────────────────────
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

    // ── 4. Register signer key on-chain (non-fatal if it fails) ─────────────
    let signerTxHash: string | null = null;
    if (keyAddSig && signedKeyRequestMetadata) {
      try {
        signerTxHash = await walletClient.writeContract({
          address: KEY_REGISTRY,
          abi: keyRegistryAbi,
          functionName: 'addFor',
          args: [
            custodyAddress as `0x${string}`,
            1,
            signerPublicKey as `0x${string}`,
            1,
            signedKeyRequestMetadata as `0x${string}`,
            BigInt(keyAddDeadline),
            keyAddSig as `0x${string}`,
          ],
        });
      } catch (signerErr: any) {
        console.error('Signer addFor failed (non-fatal):', signerErr.message?.slice(0, 200));
      }
    }

    // ── 5. Register fname (non-fatal if it fails) ────────────────────────────
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
      signerTxHash,
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
