/**
 * Farcaster signer provisioning via recovery phrase (mnemonic).
 *
 * Derives the user's Farcaster custody key from their BIP-39 mnemonic,
 * generates a fresh Ed25519 signer keypair, then registers it on-chain
 * directly via KeyRegistry.addFor() — no Warpcast approval required.
 *
 * The mnemonic is held in memory only for the duration of this function
 * and is never persisted or sent to any server.
 */

import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { secp256k1 } from '@noble/curves/secp256k1';
import { ed25519 } from '@noble/curves/ed25519';
import { hashTypedData } from 'viem';
import { privateKeyToAddress } from 'viem/accounts';
import { hexToBytes } from './fc-message-builder';

// Farcaster KeyRegistry EIP-712 domain (Optimism mainnet)
const KEY_REGISTRY_DOMAIN = {
  name: 'Farcaster KeyRegistry',
  version: '1',
  chainId: 10,
  verifyingContract: '0x00000000Fc1237824fb747aBDE0FF18990E59b7e',
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

export async function provisionSignerWithMnemonic(
  fid: number,
  mnemonic: string,
): Promise<ProvisionResult> {
  const clean = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');

  if (!validateMnemonic(clean, wordlist)) {
    throw new Error('Invalid recovery phrase — check that all words are correct and in order.');
  }

  // Derive custody secp256k1 key + address — stays in memory only
  const custodyPrivKey = mnemonicToCustodyKey(clean);
  const custodyPrivHex = bytesToHex(custodyPrivKey);
  const custodyAddress = privateKeyToAddress(custodyPrivHex);

  // Generate fresh Ed25519 signer keypair
  const edPrivKey = ed25519.utils.randomPrivateKey();
  const edPubKey  = ed25519.getPublicKey(edPrivKey);
  const signerPublicKey  = bytesToHex(edPubKey);
  const signerPrivateKey = bytesToHex(edPrivKey);

  const keyAddDeadline = Math.floor(Date.now() / 1000) + 86_400; // 24 h

  // Step 1: Fetch nonces + server-signed SignedKeyRequestMetadata
  const prepRes = await fetch(
    `/api/create-account?address=${custodyAddress}&signerKey=${signerPublicKey}&deadline=${keyAddDeadline}`,
  );
  if (!prepRes.ok) {
    const err = await prepRes.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to prepare signer registration');
  }
  const { keyAddNonce, signedKeyRequestMetadata } = await prepRes.json();

  // Step 2: Sign the KeyRegistry Add EIP-712 with the custody key (no wallet popup)
  const digest = hashTypedData({
    domain: KEY_REGISTRY_DOMAIN,
    types: {
      Add: [
        { name: 'owner',        type: 'address' },
        { name: 'keyType',      type: 'uint32'  },
        { name: 'key',          type: 'bytes'   },
        { name: 'metadataType', type: 'uint32'  },
        { name: 'metadata',     type: 'bytes'   },
        { name: 'nonce',        type: 'uint256' },
        { name: 'deadline',     type: 'uint256' },
      ],
    },
    primaryType: 'Add',
    message: {
      owner:        custodyAddress,
      keyType:      1,
      key:          signerPublicKey as `0x${string}`,
      metadataType: 1,
      metadata:     signedKeyRequestMetadata as `0x${string}`,
      nonce:        BigInt(keyAddNonce),
      deadline:     BigInt(keyAddDeadline),
    },
  });

  const sig = secp256k1.sign(hexToBytes(digest.slice(2)), custodyPrivKey);
  const r = sig.r.toString(16).padStart(64, '0');
  const s = sig.s.toString(16).padStart(64, '0');
  const v = (sig.recovery! + 27).toString(16).padStart(2, '0');
  const keyAddSig: `0x${string}` = `0x${r}${s}${v}`;

  // Step 3: Server calls KeyRegistry.addFor() — immediately approved, no Warpcast
  const addRes = await fetch('/api/add-signer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fidOwner: custodyAddress,
      signerPublicKey,
      signedKeyRequestMetadata,
      keyAddSig,
      keyAddDeadline,
    }),
  });

  if (!addRes.ok) {
    const err = await addRes.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to register signer on-chain');
  }

  return {
    publicKeyHex:       signerPublicKey.slice(2),
    privateKeyHex:      signerPrivateKey.slice(2),
    status:             'approved',
    signer_uuid:        undefined,
    signer_approval_url: null,
  };
}
