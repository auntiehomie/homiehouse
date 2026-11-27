'use client';

import { ed25519 } from '@noble/curves/ed25519';
import { farcasterTimestamp, hexToBytes } from '@/lib/fc-message-builder';
import { encodeKeyAddSignedMessage } from '@/lib/hypersnap-key-add-message';

export const HYPERSNAP_SIGNER_TTL_SECONDS = 30 * 24 * 60 * 60;
export const HYPERSNAP_SIGNER_SCOPES = [1, 2, 3, 4, 5, 6] as const;

export const HYPERSNAP_KEY_ADD_DOMAIN = {
  name: 'Farcaster KeyAdd',
  version: '1',
  chainId: 1,
} as const;

export const HYPERSNAP_KEY_ADD_TYPES = {
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

export interface KeyAddSigningPayload {
  domain: typeof HYPERSNAP_KEY_ADD_DOMAIN;
  types: typeof HYPERSNAP_KEY_ADD_TYPES;
  primaryType: 'KeyAdd';
  message: {
    fid: bigint;
    key: `0x${string}`;
    keyType: 1;
    scopes: number[];
    ttl: number;
    nonce: number;
    deadline: bigint;
  };
}

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function bytesToRawHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export interface HypersnapSignerResult {
  publicKeyHex: string;
  privateKeyHex: string;
}

export async function registerHypersnapSigner(
  fid: number,
  connectedAddress: string,
  signTypedData: (payload: KeyAddSigningPayload) => Promise<`0x${string}`>,
  registrationTxHash?: `0x${string}`,
): Promise<HypersnapSignerResult> {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  const publicKeyHex = bytesToHex(publicKey);

  const prepareResponse = await fetch('/api/hypersnap/signer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'prepare', fid, publicKey: publicKeyHex, registrationTxHash }),
    cache: 'no-store',
  });
  const prepared = await prepareResponse.json().catch(() => ({}));
  if (!prepareResponse.ok || !prepared.ok) {
    throw new Error(prepared.error || 'Could not prepare Hypersnap signer authorization.');
  }
  if (String(prepared.custodyAddress).toLowerCase() !== connectedAddress.toLowerCase()) {
    throw new Error('This wallet is not the custody wallet for this FID. Connect the wallet that controls the FID.');
  }
  if (!Array.isArray(prepared.scopes) || prepared.ttl !== HYPERSNAP_SIGNER_TTL_SECONDS || !prepared.metadata) {
    throw new Error('HomieHouse received an unsupported Hypersnap signer policy.');
  }

  const payload: KeyAddSigningPayload = {
    domain: HYPERSNAP_KEY_ADD_DOMAIN,
    types: HYPERSNAP_KEY_ADD_TYPES,
    primaryType: 'KeyAdd',
    message: {
      fid: BigInt(fid),
      key: publicKeyHex,
      keyType: 1,
      scopes: prepared.scopes,
      ttl: prepared.ttl,
      nonce: prepared.nonce,
      deadline: BigInt(prepared.deadline),
    },
  };
  const custodySignature = await signTypedData(payload);

  // Sign one exact message, including its timestamp. The server must verify
  // this identical protobuf rather than generating a different timestamp.
  const timestamp = farcasterTimestamp();
  const { hash } = encodeKeyAddSignedMessage({
    timestamp,
    fid,
    signerPublicKey: publicKey,
    custodySignature: hexToBytes(custodySignature),
    deadline: prepared.deadline,
    nonce: prepared.nonce,
    metadata: hexToBytes(prepared.metadata),
    registrationTxHash: prepared.registrationTxHash
      ? hexToBytes(prepared.registrationTxHash)
      : undefined,
    scopes: prepared.scopes,
    ttl: prepared.ttl,
  });
  const messageSignature = bytesToHex(ed25519.sign(hash, privateKey));

  const submitResponse = await fetch('/api/hypersnap/signer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'submit', fid, publicKey: publicKeyHex,
      timestamp, custodySignature, messageSignature,
      deadline: prepared.deadline, nonce: prepared.nonce,
      metadata: prepared.metadata, scopes: prepared.scopes, ttl: prepared.ttl,
      registrationTxHash: prepared.registrationTxHash,
    }),
    cache: 'no-store',
  });
  const submitted = await submitResponse.json().catch(() => ({}));
  if (!submitResponse.ok || !submitted.ok) {
    throw new Error(submitted.error || 'Hypersnap rejected the signer authorization.');
  }

  return {
    publicKeyHex: bytesToRawHex(publicKey),
    privateKeyHex: bytesToRawHex(privateKey),
  };
}
