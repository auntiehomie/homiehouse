/**
 * Farcaster write operations using @farcaster/core directly.
 *
 * Bypasses @standard-crypto/farcaster-js which bundles @farcaster/core@0.14.x —
 * that old version produces "invalid hash" errors on Snapchain-era hubs.
 * Instead we use the top-level @farcaster/core@0.18.x to sign messages and
 * POST the encoded protobuf directly to /v1/submitMessage.
 *
 * Server-side writes require HOMIEHOUSELOL_SIGNER_KEY — an Ed25519 private key
 * (hex, no 0x prefix) that has been registered as an authorized signer for the
 * bot's FID via /api/signer and approved in Warpcast.
 */

import {
  makeCastAdd,
  makeReactionAdd,
  makeReactionRemove,
  Message,
  NobleEd25519Signer,
  FarcasterNetwork,
  ReactionType,
  CastType,
  hexStringToBytes,
} from '@farcaster/core';
// Hypersnap hub — supports /v1/submitMessage REST endpoint.
const HUB_URL =
  (typeof process !== 'undefined' && process.env.FARCASTER_HUB_URL) ||
  'https://haatz.quilibrium.com';

/** Return the registered Ed25519 signer key for the bot FID. */
function getAppSignerKey(): { privateKeyHex: string; fid: number } {
  const appFid = parseInt(process.env.APP_FID || '0', 10);
  if (!appFid) throw new Error('APP_FID environment variable is required for server-side Farcaster writes');

  // Prefer the explicitly-registered key over any derived fallback.
  const signerKey = process.env.HOMIEHOUSELOL_SIGNER_KEY;
  if (signerKey) return { privateKeyHex: signerKey, fid: appFid };

  throw new Error('HOMIEHOUSELOL_SIGNER_KEY is required — set it to the registered Ed25519 private key for the bot FID');
}

function buildSigner(privateKeyHex: string): NobleEd25519Signer {
  const bytes = Buffer.from(privateKeyHex, 'hex');
  return new NobleEd25519Signer(bytes);
}

/** POST encoded Message protobuf to the hub's /v1/submitMessage endpoint. */
async function submitToHub(messageBytes: Uint8Array): Promise<{ hash: string }> {
  const res = await fetch(`${HUB_URL}/v1/submitMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: Buffer.from(messageBytes),
    // @ts-ignore — AbortSignal.timeout available in Node 18+
    signal: AbortSignal.timeout(12000),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Hub ${res.status}: ${body.slice(0, 300)}`);
  }

  let data: any;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`Hub returned non-JSON: ${body.slice(0, 200)}`);
  }

  // hash is base64-encoded in the JSON response; convert to hex
  const hashB64: string = data.hash ?? '';
  if (!hashB64) {
    return { hash: '' };
  }
  return { hash: Buffer.from(hashB64, 'base64').toString('hex') };
}

/**
 * Publish a cast to Farcaster.
 */
export async function publishCast(params: {
  text: string;
  fid: number;
  embeds?: { url: string }[];
  parentCastHash?: string;
  parentCastFid?: number;
  parentUrl?: string;
  channelKey?: string;
  /** Ed25519 private key hex from the registered signer (preferred over APP_MNEMONIC derivation) */
  signerPrivateKey?: string;
}): Promise<{ castHash: string }> {
  const { privateKeyHex: derivedKey, fid: appFid } = getAppSignerKey();
  const privateKeyHex = params.signerPrivateKey || derivedKey;
  const castFid = params.fid || appFid;
  const signer = buildSigner(privateKeyHex);

  const castBody: Parameters<typeof makeCastAdd>[0] = {
    type: CastType.CAST,
    text: params.text,
    embeds: params.embeds?.map((e) => ({ url: e.url })) ?? [],
    embedsDeprecated: [],
    mentions: [],
    mentionsPositions: [],
  };

  if (params.parentCastHash) {
    const hashResult = hexStringToBytes(params.parentCastHash);
    if (hashResult.isErr()) throw hashResult.error;
    castBody.parentCastId = {
      fid: params.parentCastFid ?? 0,
      hash: hashResult.value,
    };
  } else if (params.parentUrl) {
    castBody.parentUrl = params.parentUrl;
  }

  const msg = await makeCastAdd(castBody, { fid: castFid, network: FarcasterNetwork.MAINNET }, signer);
  if (msg.isErr()) throw msg.error;

  const messageBytes = Message.encode(msg.value).finish();
  const { hash } = await submitToHub(messageBytes);
  return { castHash: hash };
}

/**
 * Publish a like or recast reaction.
 */
export async function publishReaction(params: {
  reactionType: 'like' | 'recast';
  targetCastHash: string;
  targetCastFid: number;
  fid: number;
  /** Ed25519 private key hex from the registered signer (preferred over APP_MNEMONIC derivation) */
  signerPrivateKey?: string;
}): Promise<void> {
  const { privateKeyHex: derivedKey, fid: appFid } = getAppSignerKey();
  const privateKeyHex = params.signerPrivateKey || derivedKey;
  const castFid = params.fid || appFid;
  const signer = buildSigner(privateKeyHex);

  const hashResult = hexStringToBytes(params.targetCastHash);
  if (hashResult.isErr()) throw hashResult.error;

  const msg = await makeReactionAdd(
    {
      type: params.reactionType === 'like' ? ReactionType.LIKE : ReactionType.RECAST,
      targetCastId: { fid: params.targetCastFid, hash: hashResult.value },
    },
    { fid: castFid, network: FarcasterNetwork.MAINNET },
    signer
  );
  if (msg.isErr()) throw msg.error;

  const messageBytes = Message.encode(msg.value).finish();
  await submitToHub(messageBytes);
}

/**
 * Remove a like or recast reaction.
 */
export async function deleteReaction(params: {
  reactionType: 'like' | 'recast';
  targetCastHash: string;
  targetCastFid: number;
  fid: number;
  /** Ed25519 private key hex from the registered signer (preferred over APP_MNEMONIC derivation) */
  signerPrivateKey?: string;
}): Promise<void> {
  const { privateKeyHex: derivedKey, fid: appFid } = getAppSignerKey();
  const privateKeyHex = params.signerPrivateKey || derivedKey;
  const castFid = params.fid || appFid;
  const signer = buildSigner(privateKeyHex);

  const hashResult = hexStringToBytes(params.targetCastHash);
  if (hashResult.isErr()) throw hashResult.error;

  const msg = await makeReactionRemove(
    {
      type: params.reactionType === 'like' ? ReactionType.LIKE : ReactionType.RECAST,
      targetCastId: { fid: params.targetCastFid, hash: hashResult.value },
    },
    { fid: castFid, network: FarcasterNetwork.MAINNET },
    signer
  );
  if (msg.isErr()) throw msg.error;

  const messageBytes = Message.encode(msg.value).finish();
  await submitToHub(messageBytes);
}

/** @deprecated No longer needed — call publishCast/publishReaction directly. */
export function getHubClient() {
  throw new Error('getHubClient: removed — use publishCast/publishReaction directly');
}
