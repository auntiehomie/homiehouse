/**
 * Farcaster signer provisioning via recovery phrase (mnemonic).
 *
 * The user's BIP-39 mnemonic is used to derive their Farcaster custody
 * secp256k1 key (m/44'/60'/0'/0/0).  That key signs a SignedKeyRequest
 * EIP-712 message with the user's own FID as requestFid, using the standard
 * Farcaster SignedKeyRequestValidator domain (chainId 10, OP Mainnet).
 *
 * The signed request is submitted via /api/register-user-key, which forwards
 * to the Warpcast API.  Because the signer IS the FID owner's custody address,
 * Warpcast may auto-approve the request; if still pending, the caller receives
 * an approval URL that can be shown as a QR code.
 *
 * The mnemonic is held in memory only for the duration of this function and
 * is never persisted or sent to any server.
 */

import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { secp256k1 } from '@noble/curves/secp256k1';
import { ed25519 } from '@noble/curves/ed25519';
import { hashTypedData } from 'viem';
import { hexToBytes } from './fc-message-builder';

// Standard Farcaster SignedKeyRequestValidator on OP Mainnet
const SIGNED_KEY_REQUEST_DOMAIN = {
  name: 'Farcaster SignedKeyRequestValidator',
  version: '1',
  chainId: 10,
  verifyingContract: '0x00000000fc700472606ed4fa22623acf62c60553',
} as const;

export interface ProvisionResult {
  publicKeyHex: string;
  privateKeyHex: string;
  status: 'approved' | 'pending';
  signer_uuid?: string;
  signer_approval_url?: string | null;
}

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

function secp256k1Sign65(digestHex: `0x${string}`, privateKey: Uint8Array): Uint8Array {
  const sig = secp256k1.sign(hexToBytes(digestHex), privateKey);
  const r = hexToBytes(sig.r.toString(16).padStart(64, '0'));
  const s = hexToBytes(sig.s.toString(16).padStart(64, '0'));
  return new Uint8Array([...r, ...s, sig.recovery! + 27]);
}

export async function provisionSignerWithMnemonic(
  fid: number,
  mnemonic: string,
): Promise<ProvisionResult> {
  const clean = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');

  if (!validateMnemonic(clean, wordlist)) {
    throw new Error('Invalid recovery phrase — check that all words are correct and in order.');
  }

  // Derive custody key — stays in memory only
  const custodyPrivKey = mnemonicToCustodyKey(clean);

  // Fresh Ed25519 keypair for this signer
  const edPrivKey = ed25519.utils.randomPrivateKey();
  const edPubKey = ed25519.getPublicKey(edPrivKey);
  const keyHex = bytesToHex(edPubKey);

  const deadline = Math.floor(Date.now() / 1000) + 3600;

  // Sign SignedKeyRequest EIP-712 using the user's OWN FID as requestFid.
  // Because the signer's custody address matches the FID owner, Warpcast
  // may auto-approve or present a simplified approval UI.
  const digest = hashTypedData({
    domain: SIGNED_KEY_REQUEST_DOMAIN,
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
  const sigBytes = secp256k1Sign65(digest, custodyPrivKey);
  const signatureHex = bytesToHex(sigBytes);

  // Submit via server proxy (avoids CORS with Warpcast API)
  const res = await fetch('/api/register-user-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: keyHex,
      requestFid: fid,
      deadline,
      signature: signatureHex,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Registration failed (${res.status})`);
  }

  return {
    publicKeyHex: keyHex.slice(2),
    privateKeyHex: bytesToHex(edPrivKey).slice(2),
    status: data.status === 'approved' ? 'approved' : 'pending',
    signer_uuid: data.token,
    signer_approval_url: data.signer_approval_url,
  };
}
