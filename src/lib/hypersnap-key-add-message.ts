/**
 * Shared canonical KEY_ADD message encoding.
 *
 * The Ed25519 proof covers the full protobuf MessageData, including its
 * Farcaster-epoch timestamp. The browser sends that signed timestamp to the
 * server; recomputing it independently there invalidates every proof that
 * crosses a one-second boundary (especially Android wallet handoffs).
 */
import {
  blake3_20,
  encodeMessageData,
  farcasterTimestamp,
  FarcasterNetwork,
  MessageType,
} from './fc-message-builder';

export interface KeyAddSignedMessage {
  timestamp: number;
  fid: number;
  signerPublicKey: Uint8Array;
  custodySignature: Uint8Array;
  deadline: number;
  nonce: number;
  metadata: Uint8Array;
  registrationTxHash?: Uint8Array;
  scopes: number[];
  ttl: number;
}

/** Reject malformed, stale or excessively future-dated messages at submission. */
export function isValidKeyAddTimestamp(value: unknown, now: number = farcasterTimestamp()): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && Math.abs(value - now) <= 5 * 60;
}

export function encodeKeyAddSignedMessage(input: KeyAddSignedMessage): {
  dataBytes: Uint8Array;
  hash: Uint8Array;
} {
  const dataBytes = encodeMessageData({
    type: MessageType.KEY_ADD,
    fid: input.fid,
    timestamp: input.timestamp,
    network: FarcasterNetwork.MAINNET,
    body: {
      keyAddBody: {
        signerPublicKey: input.signerPublicKey,
        custodySignature: input.custodySignature,
        deadline: input.deadline,
        nonce: input.nonce,
        metadata: input.metadata,
        registrationTxHash: input.registrationTxHash,
        scopes: input.scopes,
        ttl: input.ttl,
      },
    },
  });
  return { dataBytes, hash: blake3_20(dataBytes) };
}
