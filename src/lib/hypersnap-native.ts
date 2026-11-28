/**
 * Native Hypersnap account registration (server-only).
 *
 * Since the validator fork on Nov 12, 2026, Hypersnap no longer reads the
 * Farcaster IdRegistry on Optimism. New accounts are registered natively:
 *
 *   1. Read the current shard-0 anchor and difficulty (GET /v1/nativeRegistration).
 *   2. Mine a SHA-256 proof of work over custody + anchor (~2^22 hashes).
 *   3. The custody wallet signs the EIP-712 `HyperNativeOnboard` payload.
 *   4. Submit a NATIVE_ONBOARD (type 160) message with fid 0 and no signer.
 *   5. Shard 0 assigns a native FID (>= 2^32), readable through
 *      GET /v1/nativeAccount?custody=0x… or ?fid=….
 *
 * No transaction, gas or storage rent is involved. One native FID per custody
 * address, and custody cannot be changed afterwards.
 *
 * Mirrors farcasterorg/hypersnap src/native_registration.rs and
 * src/bin/native_register.rs. Never import this from browser code.
 */

import { createHash } from 'crypto';
import { blake3_20, farcasterTimestamp, FarcasterNetwork, ProtoWriter } from '@/lib/fc-message-builder';
import { fetchFromHypersnapNodes } from '@/lib/hypersnap-nodes';

/** First native FID (2^32). Smaller FIDs are legacy Farcaster registrations. */
export const FIRST_NATIVE_FID = 4_294_967_296;
export const NATIVE_ONBOARD_MESSAGE_TYPE = 160;
/** MessageData field that carries the serialized HyperNativeOnboardBody. */
const NATIVE_ONBOARD_BODY_FIELD = 1160;
const MAX_DIFFICULTY_BITS = 40;

export function isNativeFid(fid: number | bigint | string): boolean {
  try {
    return BigInt(fid) >= BigInt(FIRST_NATIVE_FID);
  } catch {
    return false;
  }
}

/**
 * JSON FID from a node (native FIDs come back as decimal strings) → number.
 * Native FIDs stay far below 2^53 for the foreseeable future; anything that
 * isn't a safe positive integer is rejected rather than rounded.
 */
export function parseFid(value: unknown): number | null {
  const fid = typeof value === 'string' && /^\d{1,16}$/.test(value) ? Number(value) : value;
  return typeof fid === 'number' && Number.isSafeInteger(fid) && fid > 0 ? fid : null;
}

// ── Proof of work ───────────────────────────────────────────────────────────

function hexToBytes(hex: string, length?: number): Buffer {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(clean) || (length !== undefined && clean.length !== length * 2)) {
    throw new Error('Malformed hex value');
  }
  return Buffer.from(clean, 'hex');
}

const toHex = (bytes: Uint8Array) => `0x${Buffer.from(bytes).toString('hex')}` as `0x${string}`;

export function powHash(custody: Uint8Array, anchorHash: Uint8Array, nonce: Uint8Array): Buffer {
  return createHash('sha256').update('hyper.onboard.pow:').update(custody).update(anchorHash).update(nonce).digest();
}

export function powTargetMet(hash: Uint8Array, difficultyBits: number): boolean {
  if (difficultyBits < 0 || difficultyBits > 256) return false;
  const full = Math.floor(difficultyBits / 8);
  const rest = difficultyBits % 8;
  for (let i = 0; i < full; i++) if (hash[i] !== 0) return false;
  return rest === 0 || hash[full] < (1 << (8 - rest));
}

export function powGateCommitment(nonce: Uint8Array, difficultyBits: number): Buffer {
  const bits = Buffer.alloc(4);
  bits.writeUInt32BE(difficultyBits);
  return createHash('sha256').update('hyper.onboard.pow.commitment:').update(nonce).update(bits).digest();
}

export class PowTimeoutError extends Error {
  constructor() {
    super('Account setup took too long. Please try again.');
    this.name = 'PowTimeoutError';
  }
}

/**
 * Find an 8-byte big-endian nonce meeting `difficultyBits`, like the upstream
 * CLI. ~5 s on average for 22 bits on one core; gives up after `maxMs`.
 */
export function mineRegistrationPow(
  custody: Uint8Array,
  anchorHash: Uint8Array,
  difficultyBits: number,
  maxMs = 40_000,
): Buffer {
  if (!Number.isInteger(difficultyBits) || difficultyBits < 1 || difficultyBits > MAX_DIFFICULTY_BITS) {
    throw new Error(`Unsupported registration difficulty: ${difficultyBits}`);
  }
  const prefix = createHash('sha256').update('hyper.onboard.pow:').update(custody).update(anchorHash);
  const nonce = Buffer.alloc(8);
  const deadline = Date.now() + maxMs;
  for (let n = 0n; ; n++) {
    nonce.writeBigUInt64BE(n);
    if (powTargetMet(prefix.copy().update(nonce).digest(), difficultyBits)) return Buffer.from(nonce);
    if ((n & 0xffffn) === 0n && Date.now() > deadline) throw new PowTimeoutError();
  }
}

// ── EIP-712 custody authorization ───────────────────────────────────────────

export const NATIVE_ONBOARD_DOMAIN = { name: 'HypersnapNativeOnboard', version: '1', chainId: 10 } as const;
export const NATIVE_ONBOARD_TYPES = {
  HyperNativeOnboard: [
    { name: 'custody', type: 'address' },
    { name: 'anchor_block_height', type: 'uint64' },
    { name: 'anchor_block_hash', type: 'bytes32' },
    { name: 'gate_commitment', type: 'bytes32' },
  ],
} as const;

export interface NativeOnboardProof {
  custodyAddress: `0x${string}`;
  anchorBlockHeight: number;
  anchorBlockHash: `0x${string}`;
  nonce: `0x${string}`;
  difficultyBits: number;
}

/** Typed data the custody wallet signs (viem `signTypedData` / eth_signTypedData_v4 shape). */
export function nativeOnboardTypedData(proof: NativeOnboardProof) {
  return {
    domain: NATIVE_ONBOARD_DOMAIN,
    types: NATIVE_ONBOARD_TYPES,
    primaryType: 'HyperNativeOnboard' as const,
    message: {
      custody: proof.custodyAddress,
      anchor_block_height: BigInt(proof.anchorBlockHeight),
      anchor_block_hash: proof.anchorBlockHash,
      gate_commitment: toHex(powGateCommitment(hexToBytes(proof.nonce), proof.difficultyBits)),
    },
  };
}

/** True when the proof's nonce actually meets its difficulty for this custody and anchor. */
export function verifyNativeOnboardPow(proof: NativeOnboardProof): boolean {
  try {
    return powTargetMet(
      powHash(hexToBytes(proof.custodyAddress, 20), hexToBytes(proof.anchorBlockHash, 32), hexToBytes(proof.nonce)),
      proof.difficultyBits,
    );
  } catch {
    return false;
  }
}

// ── Message encoding ────────────────────────────────────────────────────────

/**
 * Serialized Message for POST /v1/submitMessage: hash + BLAKE3 scheme +
 * data_bytes, with no signer or signature (custody authorizes inside the body).
 */
export function encodeNativeOnboardMessage(
  proof: NativeOnboardProof & { custodySignature: `0x${string}` },
  options: { timestamp?: number; network?: FarcasterNetwork } = {},
): { messageBytes: Uint8Array; hash: Uint8Array; dataBytes: Uint8Array } {
  const pow = new ProtoWriter();
  pow.writeBytesField(1, hexToBytes(proof.nonce));
  pow.writeVarintField(2, proof.difficultyBits);

  const body = new ProtoWriter();
  body.writeBytesField(1, hexToBytes(proof.custodyAddress, 20));
  body.writeBytesField(2, hexToBytes(proof.custodySignature, 65));
  body.writeVarintField(3, BigInt(proof.anchorBlockHeight));
  body.writeBytesField(4, hexToBytes(proof.anchorBlockHash, 32));
  body.writeSubMessage(5, pow.bytes());

  // fid (field 2) is 0 and therefore omitted, as prost encodes it.
  const data = new ProtoWriter();
  data.writeVarintField(1, NATIVE_ONBOARD_MESSAGE_TYPE);
  data.writeVarintField(3, options.timestamp ?? farcasterTimestamp());
  data.writeVarintField(4, options.network ?? FarcasterNetwork.MAINNET);
  data.writeBytesField(NATIVE_ONBOARD_BODY_FIELD, body.bytes());
  const dataBytes = data.bytes();
  const hash = blake3_20(dataBytes);

  const message = new ProtoWriter();
  message.writeBytesField(2, hash);
  message.writeVarintField(3, 1); // HASH_SCHEME_BLAKE3
  message.writeBytesField(7, dataBytes);
  return { messageBytes: message.bytes(), hash, dataBytes };
}

// ── Node lookups ────────────────────────────────────────────────────────────

export interface NativeRegistrationInfo {
  active: boolean;
  nextBlock: number;
  anchorBlockHeight: number;
  anchorBlockHash: `0x${string}`;
  minDifficultyBits: number;
  anchorWindow: number;
}

export async function getNativeRegistrationInfo(): Promise<NativeRegistrationInfo> {
  const { response } = await fetchFromHypersnapNodes('/v1/nativeRegistration', {
    timeoutMs: 8_000, label: 'hypersnap/native',
  });
  if (!response.ok) throw new Error(`Hypersnap registration info failed (${response.status}).`);
  const info = await response.json();
  const anchorBlockHash = String(info.anchorBlockHash ?? '');
  const result: NativeRegistrationInfo = {
    active: info.active === true,
    nextBlock: Number(info.nextBlock),
    anchorBlockHeight: Number(info.anchorBlockHeight),
    anchorBlockHash: anchorBlockHash as `0x${string}`,
    minDifficultyBits: Number(info.minDifficultyBits),
    anchorWindow: Number(info.anchorWindow),
  };
  if (!/^0x[0-9a-fA-F]{64}$/.test(anchorBlockHash) || !Number.isSafeInteger(result.anchorBlockHeight) ||
      !Number.isSafeInteger(result.minDifficultyBits) || result.minDifficultyBits < 1 ||
      result.minDifficultyBits > MAX_DIFFICULTY_BITS) {
    throw new Error('Hypersnap returned unusable registration info.');
  }
  return result;
}

export interface NativeAccount {
  fid: number;
  custodyAddress: `0x${string}`;
}

async function lookupNativeAccount(query: string): Promise<NativeAccount | null> {
  const { response } = await fetchFromHypersnapNodes(`/v1/nativeAccount?${query}`, {
    timeoutMs: 8_000, label: 'hypersnap/native',
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    // Nodes answer an unknown custody/FID with a not-found error body.
    if (/not.?found|no native/i.test(text)) return null;
    throw new Error(`Hypersnap native account lookup failed (${response.status}).`);
  }
  const data = await response.json();
  const fid = parseFid(data.fid);
  const custodyAddress = String(data.custodyAddress ?? '');
  if (!fid || !/^0x[0-9a-fA-F]{40}$/.test(custodyAddress)) return null;
  return { fid, custodyAddress: custodyAddress.toLowerCase() as `0x${string}` };
}

/** Native FID whose custody is `address`, or null. */
export function getNativeAccountByCustody(address: string): Promise<NativeAccount | null> {
  return lookupNativeAccount(`custody=${encodeURIComponent(address.toLowerCase())}`);
}

/** Custody address of a native FID, or null when Hypersnap has no such account. */
export async function getNativeCustodyOf(fid: number): Promise<`0x${string}` | null> {
  return (await lookupNativeAccount(`fid=${fid}`))?.custodyAddress ?? null;
}

/** Submit a signed NATIVE_ONBOARD message. Returns the node's error text when rejected. */
export async function submitNativeOnboard(messageBytes: Uint8Array): Promise<{ ok: boolean; status: number; error?: string }> {
  const { response } = await fetchFromHypersnapNodes('/v1/submitMessage', {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: Buffer.from(messageBytes),
    timeoutMs: 12_000,
    label: 'hypersnap/native',
  });
  if (response.ok) return { ok: true, status: response.status };
  const text = await response.text().catch(() => '');
  let error = text.slice(0, 240);
  try {
    const data = JSON.parse(text);
    error = data.details || data.message || data.errMsg || error;
  } catch { /* keep raw text */ }
  return { ok: false, status: response.status, error };
}
