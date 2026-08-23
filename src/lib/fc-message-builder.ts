/**
 * Farcaster message builder — builds, hashes, and serialises Message protobufs
 * for POST /v1/submitMessage to Hypersnap (haatz.quilibrium.com).
 *
 * Ported from QuilibriumNetwork/quorum-shared/src/farcaster/messageBuilder.ts
 * with minor adaptations for the homiehouse context.
 *
 * No external Farcaster SDK dependency — only @noble/hashes/blake3.
 */

import { blake3 } from '@noble/hashes/blake3';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum MessageType {
  NONE = 0,
  CAST_ADD = 1,
  CAST_REMOVE = 2,
  REACTION_ADD = 3,
  REACTION_REMOVE = 4,
  LINK_ADD = 5,
  LINK_REMOVE = 6,
  KEY_ADD = 11,
  KEY_REMOVE = 12,
}

export enum HashScheme {
  BLAKE3 = 1,
}

export enum SignatureScheme {
  ED25519 = 1,
}

export enum FarcasterNetwork {
  MAINNET = 1,
}

export enum ReactionType {
  LIKE = 1,
  RECAST = 2,
}

export enum CastType {
  CAST = 0,
  LONG_CAST = 1,
}

/** Farcaster epoch start (ms) — 2021-01-01 00:00:00 UTC */
export const FARCASTER_EPOCH_MS = 1609459200000;

export function farcasterTimestamp(now: number = Date.now()): number {
  return Math.floor((now - FARCASTER_EPOCH_MS) / 1000);
}

// ---------------------------------------------------------------------------
// Minimal protobuf writer
// ---------------------------------------------------------------------------

class ProtoWriter {
  private chunks: Uint8Array[] = [];

  private varint(v: bigint): Uint8Array {
    const out: number[] = [];
    let n = v < 0n ? BigInt.asUintN(64, v) : v;
    do {
      let b = Number(n & 0x7fn);
      n >>= 7n;
      if (n > 0n) b |= 0x80;
      out.push(b);
    } while (n > 0n);
    return new Uint8Array(out);
  }

  writeVarintField(field: number, value: number | bigint): void {
    const tag = new Uint8Array(this.varint(BigInt((field << 3) | 0)));
    const val = new Uint8Array(this.varint(BigInt(value)));
    this.chunks.push(tag, val);
  }

  writeStringField(field: number, value: string): void {
    const enc = new TextEncoder().encode(value);
    this.writeBytesField(field, enc);
  }

  writeBytesField(field: number, value: Uint8Array): void {
    const tag = new Uint8Array(this.varint(BigInt((field << 3) | 2)));
    const len = new Uint8Array(this.varint(BigInt(value.length)));
    this.chunks.push(tag, len, value);
  }

  writeSubMessage(field: number, value: Uint8Array): void {
    this.writeBytesField(field, value);
  }

  writePackedVarint(field: number, values: bigint[]): void {
    if (values.length === 0) return;
    const inner = new ProtoWriter();
    for (const v of values) {
      const bytes = inner.varint(v);
      inner.chunks.push(bytes);
    }
    this.writeBytesField(field, inner.bytes());
  }

  bytes(): Uint8Array {
    const len = this.chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(len);
    let off = 0;
    for (const c of this.chunks) { out.set(c, off); off += c.length; }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Body encoders
// ---------------------------------------------------------------------------

export type CastEmbed = { url: string } | { castId: { fid: number; hash: Uint8Array } };

export interface CastAddInput {
  text: string;
  embeds?: CastEmbed[];
  mentions?: number[];
  mentionsPositions?: number[];
  parent?: { castId: { fid: number; hash: Uint8Array } } | { url: string };
  type?: CastType;
}

export interface ReactionInput {
  type: ReactionType;
  target: { castId: { fid: number; hash: Uint8Array } } | { url: string };
}

export interface LinkInput {
  type: string;
  targetFid: number;
}

function encodeCastId(fid: number, hash: Uint8Array): Uint8Array {
  const w = new ProtoWriter();
  w.writeVarintField(1, BigInt(fid));
  w.writeBytesField(2, hash);
  return w.bytes();
}

function encodeEmbed(e: CastEmbed): Uint8Array {
  const w = new ProtoWriter();
  if ('url' in e) {
    w.writeStringField(1, e.url);
  } else {
    w.writeSubMessage(2, encodeCastId(e.castId.fid, e.castId.hash));
  }
  return w.bytes();
}

export function encodeCastAddBody(input: CastAddInput): Uint8Array {
  const w = new ProtoWriter();
  if (input.mentions?.length) {
    w.writePackedVarint(2, input.mentions.map(BigInt));
  }
  if (input.parent && 'castId' in input.parent) {
    w.writeSubMessage(3, encodeCastId(input.parent.castId.fid, input.parent.castId.hash));
  } else if (input.parent && 'url' in input.parent) {
    w.writeStringField(7, input.parent.url);
  }
  w.writeStringField(4, input.text);
  if (input.mentionsPositions?.length) {
    w.writePackedVarint(5, input.mentionsPositions.map(BigInt));
  }
  for (const embed of input.embeds ?? []) {
    w.writeSubMessage(6, encodeEmbed(embed));
  }
  if (input.type !== undefined && input.type !== CastType.CAST) {
    w.writeVarintField(8, input.type);
  }
  return w.bytes();
}

export function encodeReactionBody(input: ReactionInput): Uint8Array {
  const w = new ProtoWriter();
  w.writeVarintField(1, input.type);
  if ('castId' in input.target) {
    w.writeSubMessage(2, encodeCastId(input.target.castId.fid, input.target.castId.hash));
  } else {
    w.writeStringField(3, input.target.url);
  }
  return w.bytes();
}

export function encodeLinkBody(input: LinkInput): Uint8Array {
  const w = new ProtoWriter();
  w.writeStringField(1, input.type);
  w.writeVarintField(3, BigInt(input.targetFid));
  return w.bytes();
}

export interface KeyAddInput {
  signerPublicKey: Uint8Array;  // 32-byte Ed25519 public key
  custodySignature: Uint8Array; // 65-byte secp256k1 EIP-712 signature
  deadline: number;
  nonce: number;
  metadata: Uint8Array;         // ABI-encoded SignedKeyRequestMetadata
  scopes: number[];             // MessageType values allowed for this signer
  ttl: number;                  // seconds
}

const ED25519_KEY_TYPE = 1;
const METADATA_TYPE = 1;

export function encodeKeyAddBody(input: KeyAddInput): Uint8Array {
  const w = new ProtoWriter();
  w.writeBytesField(1, input.signerPublicKey);
  w.writeVarintField(2, ED25519_KEY_TYPE);
  w.writeBytesField(3, input.custodySignature);
  w.writeVarintField(4, input.deadline);
  w.writeVarintField(5, input.nonce);
  w.writeBytesField(6, input.metadata);
  w.writeVarintField(7, METADATA_TYPE);
  w.writePackedVarint(9, input.scopes.map(BigInt));
  w.writeVarintField(10, input.ttl);
  return w.bytes();
}

// ---------------------------------------------------------------------------
// MessageData + envelope
// ---------------------------------------------------------------------------

export interface MessageDataInput {
  type: MessageType;
  fid: number;
  timestamp?: number;
  network?: FarcasterNetwork;
  body:
    | { castAddBody: CastAddInput }
    | { castRemoveBody: { targetHash: Uint8Array } }
    | { reactionBody: ReactionInput }
    | { linkBody: LinkInput }
    | { keyAddBody: KeyAddInput };
}

export function encodeMessageData(input: MessageDataInput): Uint8Array {
  const w = new ProtoWriter();
  w.writeVarintField(1, input.type);
  w.writeVarintField(2, BigInt(input.fid));
  w.writeVarintField(3, input.timestamp ?? farcasterTimestamp());
  w.writeVarintField(4, input.network ?? FarcasterNetwork.MAINNET);
  if ('castAddBody' in input.body) {
    w.writeSubMessage(5, encodeCastAddBody(input.body.castAddBody));
  } else if ('castRemoveBody' in input.body) {
    const rb = new ProtoWriter();
    rb.writeBytesField(1, input.body.castRemoveBody.targetHash);
    w.writeSubMessage(6, rb.bytes());
  } else if ('reactionBody' in input.body) {
    w.writeSubMessage(7, encodeReactionBody(input.body.reactionBody));
  } else if ('linkBody' in input.body) {
    w.writeSubMessage(14, encodeLinkBody(input.body.linkBody));
  } else if ('keyAddBody' in input.body) {
    w.writeSubMessage(19, encodeKeyAddBody(input.body.keyAddBody));
  }
  return w.bytes();
}

/** BLAKE3 truncated to 20 bytes */
export function blake3_20(data: Uint8Array): Uint8Array {
  return blake3(data, { dkLen: 20 });
}

export function encodeMessageEnvelope(input: {
  dataBytes: Uint8Array;
  hash: Uint8Array;
  signature: Uint8Array;
  signer: Uint8Array;
}): Uint8Array {
  const w = new ProtoWriter();
  w.writeBytesField(2, input.hash);
  w.writeVarintField(3, HashScheme.BLAKE3);
  w.writeBytesField(4, input.signature);
  w.writeVarintField(5, SignatureScheme.ED25519);
  w.writeBytesField(6, input.signer);
  w.writeBytesField(7, input.dataBytes);
  return w.bytes();
}

/** Signer interface for Farcaster message signing */
export interface FarcasterSigner {
  publicKey: Uint8Array;
  sign(hash: Uint8Array): Promise<Uint8Array>;
}

/** Build a fully signed Message ready for submitMessage */
export async function buildSignedMessage(
  data: MessageDataInput,
  signer: FarcasterSigner,
): Promise<Uint8Array> {
  const dataBytes = encodeMessageData(data);
  const hash = blake3_20(dataBytes);
  const signature = await signer.sign(hash);
  return encodeMessageEnvelope({ dataBytes, hash, signature, signer: signer.publicKey });
}

// ---------------------------------------------------------------------------
// hex helpers
// ---------------------------------------------------------------------------

export function hexToBytes(hex: string): Uint8Array {
  const s = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}
