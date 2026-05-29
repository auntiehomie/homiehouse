/**
 * Farcaster signer provisioning via recovery phrase (mnemonic).
 *
 * Implements the Quorum/Hypersnap KEY_ADD approach:
 *   1. Derive user's custody secp256k1 key from BIP-39 mnemonic
 *   2. Generate a fresh Ed25519 keypair
 *   3. Build and sign a KEY_ADD hub message (two EIP-712 signatures)
 *   4. Submit directly to the Hypersnap hub via the /api/submit-cast proxy
 *
 * No Farcaster app approval step needed — the user's custody key IS the
 * authorization. The mnemonic is held in memory only for the duration of
 * this function and never persisted anywhere.
 *
 * Reference: QuilibriumNetwork/quorum-shared src/farcaster/signerLifecycle.ts
 */

import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { secp256k1 } from '@noble/curves/secp256k1';
import { ed25519 } from '@noble/curves/ed25519';
import { hashTypedData, encodeAbiParameters } from 'viem';
import { privateKeyToAddress } from 'viem/accounts';
import {
  blake3_20,
  encodeMessageEnvelope,
  encodeMessageData,
  farcasterTimestamp,
  FarcasterNetwork,
  MessageType,
  hexToBytes,
} from './fc-message-builder';

// EIP-712 domain used by Quorum for hub-level KEY_ADD (not the on-chain OP Mainnet domain)
const KEY_ADD_DOMAIN = {
  name: 'Farcaster KeyAdd',
  version: '1',
  chainId: 1,
} as const;

// All write operations the signer will be allowed to perform
const SIGNER_SCOPES = [1, 2, 3, 4, 5, 6]; // CAST_ADD through LINK_REMOVE
const TTL_SECONDS = 90 * 24 * 60 * 60;    // 90 days

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
}

function mnemonicToCustodyKey(mnemonic: string): Uint8Array {
  const seed = mnemonicToSeedSync(mnemonic);
  const hdKey = HDKey.fromMasterSeed(seed);
  const child = hdKey.derive("m/44'/60'/0'/0/0");
  if (!child.privateKey) throw new Error('Failed to derive private key from phrase');
  return child.privateKey;
}

// Produce a 65-byte Ethereum-style secp256k1 signature (r || s || v)
function secp256k1Sign65(digestHex: `0x${string}`, privateKey: Uint8Array): Uint8Array {
  const sig = secp256k1.sign(hexToBytes(digestHex), privateKey);
  const r = hexToBytes(sig.r.toString(16).padStart(64, '0'));
  const s = hexToBytes(sig.s.toString(16).padStart(64, '0'));
  return new Uint8Array([...r, ...s, sig.recovery! + 27]);
}

export async function provisionSignerWithMnemonic(
  fid: number,
  mnemonic: string,
): Promise<{ publicKeyHex: string; privateKeyHex: string }> {
  const clean = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');

  if (!validateMnemonic(clean, wordlist)) {
    throw new Error('Invalid recovery phrase — check that all words are correct and in order.');
  }

  // Derive custody key — stays in memory only
  const custodyPrivKey = mnemonicToCustodyKey(clean);
  const custodyAddr = privateKeyToAddress(bytesToHex(custodyPrivKey));

  // Fresh Ed25519 keypair for this signer
  const edPrivKey = ed25519.utils.randomPrivateKey();
  const edPubKey = ed25519.getPublicKey(edPrivKey);
  const keyHex = bytesToHex(edPubKey);

  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const nonce = Math.floor(Date.now() / 1000);

  // ── Step 1: Sign SignedKeyRequest (inner signature for metadata) ──────────
  const skrDigest = hashTypedData({
    domain: KEY_ADD_DOMAIN,
    types: {
      SignedKeyRequest: [
        { name: 'requestFid', type: 'uint256' },
        { name: 'key', type: 'bytes' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'SignedKeyRequest',
    message: { requestFid: BigInt(fid), key: keyHex, deadline: BigInt(deadline) },
  });
  const metadataSig = secp256k1Sign65(skrDigest, custodyPrivKey);

  // ── Step 2: ABI-encode SignedKeyRequestMetadata ───────────────────────────
  const metadataHex = encodeAbiParameters(
    [
      { name: 'requestFid', type: 'uint256' },
      { name: 'requestSigner', type: 'address' },
      { name: 'signature', type: 'bytes' },
      { name: 'deadline', type: 'uint256' },
    ],
    [BigInt(fid), custodyAddr, bytesToHex(metadataSig), BigInt(deadline)],
  );
  const metadata = hexToBytes(metadataHex);

  // ── Step 3: Sign KeyAdd (outer custody authorization) ─────────────────────
  const keyAddDigest = hashTypedData({
    domain: KEY_ADD_DOMAIN,
    types: {
      KeyAdd: [
        { name: 'fid', type: 'uint256' },
        { name: 'key', type: 'bytes' },
        { name: 'keyType', type: 'uint32' },
        { name: 'scopes', type: 'uint32[]' },
        { name: 'ttl', type: 'uint32' },
        { name: 'nonce', type: 'uint32' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'KeyAdd',
    message: {
      fid: BigInt(fid),
      key: keyHex,
      keyType: 1,
      scopes: SIGNER_SCOPES,
      ttl: TTL_SECONDS,
      nonce,
      deadline: BigInt(deadline),
    },
  });
  const custodySignature = secp256k1Sign65(keyAddDigest, custodyPrivKey);

  // ── Step 4: Encode KEY_ADD protobuf ──────────────────────────────────────
  const dataBytes = encodeMessageData({
    type: MessageType.KEY_ADD,
    fid,
    body: {
      keyAddBody: {
        signerPublicKey: edPubKey,
        custodySignature,
        deadline,
        nonce,
        metadata,
        scopes: SIGNER_SCOPES,
        ttl: TTL_SECONDS,
      },
    },
  });

  // ── Step 5: Ed25519 self-sign the envelope ────────────────────────────────
  const hash = blake3_20(dataBytes);
  const signature = ed25519.sign(hash, edPrivKey);
  const envelope = encodeMessageEnvelope({ dataBytes, hash, signature, signer: edPubKey });

  // ── Step 6: Submit to Hypersnap hub via proxy ─────────────────────────────
  const res = await fetch('/api/submit-cast', {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: envelope as unknown as BodyInit,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.error || data?.hub?.errMsg || data?.hub?.message || `Hub error ${res.status}`;
    throw new Error(detail);
  }

  return {
    publicKeyHex: bytesToHex(edPubKey).slice(2),
    privateKeyHex: bytesToHex(edPrivKey).slice(2),
  };
}
