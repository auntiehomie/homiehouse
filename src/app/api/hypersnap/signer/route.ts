import { NextRequest, NextResponse } from 'next/server';
import { mnemonicToAccount } from 'viem/accounts';
import { createPublicClient, decodeAbiParameters, encodeAbiParameters, http, parseAbi, recoverTypedDataAddress } from 'viem';
import { optimism } from 'viem/chains';
import { ed25519 } from '@noble/curves/ed25519';
import { rateLimit } from '@/lib/ratelimit';
import {
  blake3_20,
  encodeMessageData,
  encodeMessageEnvelope,
  FarcasterNetwork,
  MessageType,
} from '@/lib/fc-message-builder';

export const dynamic = 'force-dynamic';

const ID_REGISTRY = '0x00000000fc6c5f01fc30151999387bb99a9f489b' as const;
const OP_RPC = process.env.OP_RPC_URL || 'https://mainnet.optimism.io';
const HUB_URL = process.env.NEXT_PUBLIC_HYPERSNAP_URL || 'https://haatz.quilibrium.com';
const keyDomain = { name: 'Farcaster KeyAdd', version: '1', chainId: 1 } as const;
const keyAddTypes = {
  KeyAdd: [
    { name: 'fid', type: 'uint256' },
    { name: 'key', type: 'bytes' },
    { name: 'keyType', type: 'uint32' },
    { name: 'scopes', type: 'uint32[]' },
    { name: 'ttl', type: 'uint32' },
    { name: 'nonce', type: 'uint32' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;
const signedKeyRequestTypes = {
  SignedKeyRequest: [
    { name: 'requestFid', type: 'uint256' },
    { name: 'key', type: 'bytes' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;
const metadataAbi = [{ type: 'tuple', components: [
  { name: 'requestFid', type: 'uint256' },
  { name: 'requestSigner', type: 'address' },
  { name: 'signature', type: 'bytes' },
  { name: 'deadline', type: 'uint256' },
]}] as const;
const custodyAbi = parseAbi(['function custodyOf(uint256 fid) view returns (address)']);
const publicClient = createPublicClient({ chain: optimism, transport: http(OP_RPC) });
const scopes = [1, 2, 3, 4, 5, 6]; // casts, cast removal, reactions, and follows only
const signerTtl = 30 * 24 * 60 * 60;

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function isHex(value: unknown, bytes?: number): value is `0x${string}` {
  return typeof value === 'string' && /^0x(?:[0-9a-fA-F]{2})+$/.test(value) &&
    (bytes === undefined || value.length === 2 + bytes * 2);
}

function getAppAccount() {
  const appFid = Number(process.env.APP_FID);
  const mnemonic = process.env.APP_MNEMONIC?.trim().replace(/^['"]|['"]$/g, '');
  if (!Number.isSafeInteger(appFid) || appFid <= 0 || !mnemonic) {
    throw new Error('Hypersnap signer registration is not configured (APP_FID / APP_MNEMONIC).');
  }
  return { appFid, account: mnemonicToAccount(mnemonic as `${string}`) };
}

async function custodyOf(fid: number): Promise<`0x${string}`> {
  return publicClient.readContract({
    address: ID_REGISTRY,
    abi: custodyAbi,
    functionName: 'custodyOf',
    args: [BigInt(fid)],
  });
}

async function getUserNonce(fid: number, allowUnindexedRegistration = false): Promise<number> {
  const url = new URL('/v1/signersByFid', HUB_URL);
  url.searchParams.set('fid', String(fid));
  const res = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8_000) });
  if (res.status === 404 && allowUnindexedRegistration) return 0;
  if (!res.ok) throw new Error(`Hypersnap signer lookup failed (${res.status}).`);
  const data = await res.json();
  const nonce = Number(data.currentUserNonce);
  if (!Number.isSafeInteger(nonce) || nonce < 0 || nonce >= 0xffffffff) {
    throw new Error('Hypersnap did not return a usable signer nonce.');
  }
  return nonce;
}

async function createMetadata(fid: number, publicKey: `0x${string}`, deadline: number) {
  const { appFid, account } = getAppAccount();
  const appCustody = await custodyOf(appFid);
  if (appCustody.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error('HomieHouse signer metadata key does not match APP_FID custody.');
  }
  const signature = await account.signTypedData({
    domain: keyDomain,
    types: signedKeyRequestTypes,
    primaryType: 'SignedKeyRequest',
    message: { requestFid: BigInt(appFid), key: publicKey, deadline: BigInt(deadline) },
  });
  const metadata = encodeAbiParameters(metadataAbi, [{
    requestFid: BigInt(appFid), requestSigner: account.address, signature, deadline: BigInt(deadline),
  }]);
  return { appFid, metadata };
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { success } = rateLimit(`hypersnap-signer:${ip}`, 10, 60);
  if (!success) return jsonError('Too many signer requests. Try again shortly.', 429);
  const origin = req.headers.get('origin');
  if (!origin || origin !== new URL(req.url).origin) return jsonError('Cross-origin signer requests are not allowed.', 403);

  const body = await req.json().catch(() => null);
  if (!body || !Number.isSafeInteger(Number(body.fid)) || Number(body.fid) <= 0) {
    return jsonError('A valid FID is required.', 400);
  }
  const fid = Number(body.fid);

  try {
    if (body.action === 'prepare') {
      if (!isHex(body.publicKey, 32)) return jsonError('A 32-byte Ed25519 public key is required.', 400);
      if (body.registrationTxHash !== undefined && !isHex(body.registrationTxHash, 32)) {
        return jsonError('FID registration transaction hash is malformed.', 400);
      }
      const [custodyAddress, currentNonce] = await Promise.all([
        custodyOf(fid), getUserNonce(fid, !!body.registrationTxHash),
      ]);
      const deadline = Math.floor(Date.now() / 1000) + 10 * 60;
      const { appFid, metadata } = await createMetadata(fid, body.publicKey, deadline);
      return NextResponse.json({ ok: true, fid, custodyAddress, nonce: currentNonce + 1, deadline, ttl: signerTtl, scopes, appFid, metadata, registrationTxHash: body.registrationTxHash ?? null });
    }

    if (body.action !== 'submit') return jsonError('Unsupported signer action.', 400);
    if (!isHex(body.publicKey, 32) || !isHex(body.custodySignature, 65) || !isHex(body.messageSignature, 64) || !isHex(body.metadata)) {
      return jsonError('Signer authorization fields are malformed.', 400);
    }
    if (body.registrationTxHash !== undefined && body.registrationTxHash !== null && !isHex(body.registrationTxHash, 32)) {
      return jsonError('FID registration transaction hash is malformed.', 400);
    }
    const nonce = Number(body.nonce);
    const deadline = Number(body.deadline);
    const ttl = Number(body.ttl);
    const submittedScopes = body.scopes;
    if (!Number.isSafeInteger(nonce) || nonce <= 0 || nonce > 0xffffffff ||
        !Number.isSafeInteger(deadline) || deadline <= Math.floor(Date.now() / 1000) || deadline > Math.floor(Date.now() / 1000) + 15 * 60 ||
        ttl !== signerTtl || !Array.isArray(submittedScopes) || JSON.stringify(submittedScopes) !== JSON.stringify(scopes)) {
      return jsonError('Signer authorization is expired or requests unsupported permissions.', 400);
    }

    const [custodyAddress, currentNonce] = await Promise.all([
      custodyOf(fid), getUserNonce(fid, !!body.registrationTxHash),
    ]);
    if (nonce !== currentNonce + 1) return jsonError('The Hypersnap signer nonce changed. Please retry authorization.', 409);

    const recoveredCustody = await recoverTypedDataAddress({
      domain: keyDomain,
      types: keyAddTypes,
      primaryType: 'KeyAdd',
      message: {
        fid: BigInt(fid), key: body.publicKey, keyType: 1,
        scopes: submittedScopes, ttl, nonce, deadline: BigInt(deadline),
      },
      signature: body.custodySignature,
    });
    if (recoveredCustody.toLowerCase() !== custodyAddress.toLowerCase()) {
      return jsonError('Connected wallet is not the custody wallet for this FID. Use the wallet that controls the FID.', 403);
    }

    // Check that the request metadata was signed by HomieHouse's registered custody address.
    const decoded = decodeAbiParameters(metadataAbi, body.metadata)[0];
    const { appFid, account } = getAppAccount();
    const appCustody = await custodyOf(appFid);
    const metadataSigner = await recoverTypedDataAddress({
      domain: keyDomain,
      types: signedKeyRequestTypes,
      primaryType: 'SignedKeyRequest',
      message: { requestFid: decoded.requestFid, key: body.publicKey, deadline: decoded.deadline },
      signature: decoded.signature,
    });
    if (decoded.requestFid !== BigInt(appFid) || decoded.requestSigner.toLowerCase() !== appCustody.toLowerCase() ||
        metadataSigner.toLowerCase() !== appCustody.toLowerCase() || appCustody.toLowerCase() !== account.address.toLowerCase() ||
        decoded.deadline < BigInt(Math.floor(Date.now() / 1000))) {
      return jsonError('HomieHouse signer metadata could not be verified.', 400);
    }

    const dataBytes = encodeMessageData({
      type: MessageType.KEY_ADD,
      fid,
      network: FarcasterNetwork.MAINNET,
      body: { keyAddBody: {
        signerPublicKey: Buffer.from(body.publicKey.slice(2), 'hex'),
        custodySignature: Buffer.from(body.custodySignature.slice(2), 'hex'),
        deadline, nonce,
        metadata: Buffer.from(body.metadata.slice(2), 'hex'),
        registrationTxHash: body.registrationTxHash ? Buffer.from(body.registrationTxHash.slice(2), 'hex') : undefined,
        scopes: submittedScopes, ttl,
      } },
    });
    const hash = blake3_20(dataBytes);
    const publicKeyBytes = Buffer.from(body.publicKey.slice(2), 'hex');
    const signatureBytes = Buffer.from(body.messageSignature.slice(2), 'hex');
    if (!ed25519.verify(signatureBytes, hash, publicKeyBytes)) return jsonError('Ed25519 signer proof is invalid.', 400);

    const envelope = encodeMessageEnvelope({
      dataBytes,
      hash,
      signature: signatureBytes,
      signer: publicKeyBytes,
    });
    const hubRes = await fetch(`${HUB_URL}/v1/submitMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream', accept: 'application/json' },
      body: Buffer.from(envelope),
      signal: AbortSignal.timeout(12_000),
    });
    const hubText = await hubRes.text();
    let hubData: any = {};
    try { hubData = JSON.parse(hubText); } catch { /* include the bounded response below */ }
    if (!hubRes.ok) return jsonError(hubData.message || hubData.errMsg || hubText.slice(0, 240) || `Hypersnap rejected KEY_ADD (${hubRes.status}).`, hubRes.status);
    return NextResponse.json({ ok: true, fid, publicKey: body.publicKey, hash: hubData.hash ?? null, status: 'submitted' });
  } catch (error: any) {
    console.error('[hypersnap/signer] registration failed:', error?.message || error);
    return jsonError(error?.message || 'Hypersnap signer registration failed.', 502);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fid = Number(searchParams.get('fid'));
  const publicKey = searchParams.get('publicKey');
  if (!Number.isSafeInteger(fid) || fid <= 0 || !isHex(publicKey, 32)) {
    return jsonError('Valid fid and 32-byte publicKey are required.', 400);
  }
  try {
    const url = new URL('/v1/signer', HUB_URL);
    url.searchParams.set('fid', String(fid));
    url.searchParams.set('signer', publicKey.slice(2));
    const response = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8_000) });
    if (response.status === 404) return NextResponse.json({ ok: true, active: false });
    if (!response.ok) return jsonError(`Hypersnap signer status check failed (${response.status}).`, 502);
    return NextResponse.json({ ok: true, active: true });
  } catch (error: any) {
    return jsonError(error?.message || 'Could not check Hypersnap signer status.', 502);
  }
}
