/**
 * GET /api/provision-bot-signer
 *
 * Registers a deterministic Ed25519 signer key for the bot's FID on-chain
 * via KeyGateway.addFor() — no Warpcast approval required.
 *
 * The signer private key is derived deterministically from APP_MNEMONIC at
 * BIP32 path m/44'/60'/0'/0/1 (index 1 — separate from the custody key at
 * index 0), so re-running this endpoint is idempotent: the same key is always
 * generated. If the key is already registered the endpoint returns it anyway.
 *
 * Returns:
 *   { ok, txHash?, alreadyRegistered?, signerPrivateKey, signerPublicKey, instruction }
 *
 * After running: set HOMIEHOUSELOL_SIGNER_KEY=<signerPrivateKey> in Vercel env vars.
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';
import { ed25519 } from '@noble/curves/ed25519';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodeAbiParameters,
} from 'viem';
import { optimism } from 'viem/chains';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';

// KeyGateway is the entry point for signer key registration (KeyRegistry requires it as caller)
const KEY_GATEWAY = '0x00000000fc56947c7e7183f8ca4b62398caadf0b' as const;
const SKR_VALIDATOR = '0x00000000fc700472606ed4fa22623acf62c60553' as const;
const OP_RPC = process.env.OP_RPC_URL || 'https://mainnet.optimism.io';

const keyGatewayAbi = parseAbi([
  'function nonces(address owner) view returns (uint256)',
  'function addFor(address fidOwner, uint32 keyType, bytes key, uint8 metadataType, bytes metadata, uint256 deadline, bytes sig) external',
  'error InvalidAccountNonce(uint256 nonce, uint256 expectedNonce)',
  'error InvalidSignature()',
  'error ExceedsMaximum()',
  'error InvalidState()',
  'error Unauthorized()',
  'error InvalidKeyType()',
  'error InvalidMetadataType()',
  'error SignatureExpired()',
]);

function bytesToHex(b: Uint8Array): `0x${string}` {
  return `0x${Buffer.from(b).toString('hex')}`;
}

export async function GET(req: NextRequest) {
  const APP_MNEMONIC = process.env.APP_MNEMONIC;
  const APP_FID = process.env.APP_FID;
  const APP_WALLET_PRIVATE_KEY = process.env.APP_WALLET_PRIVATE_KEY as `0x${string}` | undefined;

  if (!APP_MNEMONIC || !APP_FID || !APP_WALLET_PRIVATE_KEY) {
    return NextResponse.json(
      { error: 'APP_MNEMONIC, APP_FID, and APP_WALLET_PRIVATE_KEY must all be configured' },
      { status: 500 }
    );
  }

  const cleanMnemonic = APP_MNEMONIC.trim().replace(/^["']|["']$/g, '');
  const appFid = BigInt(APP_FID);

  // Derive deterministic Ed25519 signer key from mnemonic at BIP32 index 1
  const seed = mnemonicToSeedSync(cleanMnemonic);
  const hdKey = HDKey.fromMasterSeed(seed);
  const signerChild = hdKey.derive("m/44'/60'/0'/0/1");
  if (!signerChild.privateKey) {
    return NextResponse.json({ error: 'BIP32 derivation failed' }, { status: 500 });
  }

  const edPrivKey = signerChild.privateKey; // 32-byte entropy used as Ed25519 private key
  const edPubKey = ed25519.getPublicKey(edPrivKey);
  const signerPublicKey = bytesToHex(edPubKey);
  const signerPrivateKey = Buffer.from(edPrivKey).toString('hex'); // no 0x — for env var

  // Custody account (m/44'/60'/0'/0/0) — owns the FID on-chain
  const appAccount = mnemonicToAccount(cleanMnemonic as `${string}`);
  const custodyAddress = appAccount.address;

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86_400); // 24 h

  const publicClient = createPublicClient({ chain: optimism, transport: http(OP_RPC) });

  // Fetch current nonce for custody address from KeyGateway
  let keyAddNonce: bigint;
  try {

    // Rate limit: 30 requests/minute per IP
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`provision-bot-signer:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    keyAddNonce = await publicClient.readContract({
      address: KEY_GATEWAY,
      abi: keyGatewayAbi,
      functionName: 'nonces',
      args: [custodyAddress],
    });
  } catch (err: any) {
    console.error('[provision-bot-signer] nonce fetch failed:', err.message);
    return NextResponse.json({ error: `Failed to fetch nonce: ${err.message}` }, { status: 500 });
  }

  // Custody key signs the SignedKeyRequest authorising this Ed25519 key for appFid
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
    message: { requestFid: appFid, key: signerPublicKey, deadline },
  });

  // ABI-encode SignedKeyRequestMetadata as a TUPLE — the validator does
  // abi.decode(metadata, (SignedKeyRequestMetadata)) which requires the 0x20 tuple wrapper.
  const signedKeyRequestMetadata = encodeAbiParameters(
    [{ type: 'tuple', components: [
      { name: 'requestFid',    type: 'uint256' },
      { name: 'requestSigner', type: 'address' },
      { name: 'signature',     type: 'bytes'   },
      { name: 'deadline',      type: 'uint256' },
    ]}],
    [{ requestFid: appFid, requestSigner: custodyAddress, signature: signedKeyRequestSig, deadline }],
  );

  // Custody key signs the KeyGateway Add EIP-712 message
  // KeyGateway uses uint8 for metadataType (not uint32 like KeyRegistry)
  const keyAddSig = await appAccount.signTypedData({
    domain: {
      name: 'Farcaster KeyGateway',
      version: '1',
      chainId: 10,
      verifyingContract: KEY_GATEWAY,
    },
    types: {
      Add: [
        { name: 'owner',        type: 'address' },
        { name: 'keyType',      type: 'uint32'  },
        { name: 'key',          type: 'bytes'   },
        { name: 'metadataType', type: 'uint8'   },
        { name: 'metadata',     type: 'bytes'   },
        { name: 'nonce',        type: 'uint256' },
        { name: 'deadline',     type: 'uint256' },
      ],
    },
    primaryType: 'Add',
    message: {
      owner:        custodyAddress,
      keyType:      1,
      key:          signerPublicKey,
      metadataType: 1,
      metadata:     signedKeyRequestMetadata,
      nonce:        keyAddNonce,
      deadline,
    },
  });

  // Submit KeyGateway.addFor() — server wallet pays gas
  const serverAccount = privateKeyToAccount(APP_WALLET_PRIVATE_KEY);
  const walletClient = createWalletClient({
    account: serverAccount,
    chain: optimism,
    transport: http(OP_RPC),
  });

  const addForArgs = [
    custodyAddress,
    1,
    signerPublicKey,
    1,
    signedKeyRequestMetadata,
    deadline,
    keyAddSig,
  ] as const;

  // Simulate first to get a typed revert reason before spending gas
  try {
    await publicClient.simulateContract({
      address: KEY_GATEWAY,
      abi: keyGatewayAbi,
      functionName: 'addFor',
      args: addForArgs,
      account: serverAccount,
    });
  } catch (simErr: any) {
    const fullMsg = [simErr.shortMessage, simErr.message, simErr.details, simErr.cause?.data?.errorName].filter(Boolean).join(' | ');
    console.error('[provision-bot-signer] simulate failed:', fullMsg);

    // Key already registered — return it anyway
    if (
      fullMsg.toLowerCase().includes('already') ||
      fullMsg.includes('InvalidState') ||
      fullMsg.includes('KeyExists')
    ) {
      console.log(`[provision-bot-signer] Key already registered for FID ${APP_FID}`);
      return NextResponse.json({
        ok: true,
        alreadyRegistered: true,
        signerPublicKey: signerPublicKey.slice(2),
        signerPrivateKey,
        custodyAddress,
        instruction: `Set HOMIEHOUSELOL_SIGNER_KEY=${signerPrivateKey} in Vercel environment variables`,
      });
    }

    return NextResponse.json({
      error: simErr.shortMessage || simErr.message || 'Simulation failed',
      details: fullMsg,
      debug: { custodyAddress, signerPublicKey, appFid: APP_FID, nonce: keyAddNonce.toString() },
    }, { status: 500 });
  }

  try {
    const txHash = await walletClient.writeContract({
      address: KEY_GATEWAY,
      abi: keyGatewayAbi,
      functionName: 'addFor',
      args: addForArgs,
    });

    console.log(`[provision-bot-signer] Registered signer for FID ${APP_FID}. tx=${txHash}`);

    return NextResponse.json({
      ok: true,
      txHash,
      signerPublicKey: signerPublicKey.slice(2),
      signerPrivateKey,
      custodyAddress,
      instruction: `Set HOMIEHOUSELOL_SIGNER_KEY=${signerPrivateKey} in Vercel environment variables`,
    });
  } catch (err: any) {
    const msg: string = err.shortMessage || err.message || '';
    console.error('[provision-bot-signer] addFor failed:', msg);
    return NextResponse.json({ error: msg || 'Failed to register signer' }, { status: 500 });
  }
}
