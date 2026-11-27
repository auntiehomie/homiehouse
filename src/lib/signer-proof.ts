import { ed25519 } from '@noble/curves/ed25519';

/**
 * Signer possession proof.
 *
 * Instead of sending the Ed25519 signer private key to the server, the browser
 * signs a short-lived statement naming the FID, the time, and the site. The
 * server checks the signature against the public key, then checks that public
 * key is an approved signer for the FID.
 *
 * Headers: x-signer-public-key, x-signer-proof, x-signer-timestamp.
 */
export const SIGNER_PROOF_MAX_AGE_SECONDS = 120;

export function signerProofMessage(fid: number, timestamp: number, host: string): Uint8Array {
  return new TextEncoder().encode(`homiehouse-session-v1\nfid:${fid}\ntimestamp:${timestamp}\nhost:${host}`);
}

function toHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Browser side: build proof headers without exposing the private key. */
export function createSignerProofHeaders(
  fid: number,
  privateKeyHex: string,
  host: string = typeof window !== 'undefined' ? (window.location?.host ?? '') : '',
  now: number = Date.now(),
): Record<string, string> {
  const privateKey = fromHex(privateKeyHex);
  const timestamp = Math.floor(now / 1000);
  const signature = ed25519.sign(signerProofMessage(fid, timestamp, host), privateKey);
  return {
    'x-signer-public-key': toHex(ed25519.getPublicKey(privateKey)),
    'x-signer-proof': toHex(signature),
    'x-signer-timestamp': String(timestamp),
  };
}

export interface SignerProof {
  publicKeyHex: `0x${string}`;
  signatureHex: string;
}

/**
 * Server side: verify the proof headers for `fid` and `host`.
 * Returns null when no proof headers are present; throws on an invalid proof.
 */
export function readSignerProof(headers: Headers, fid: number, host: string, now: number = Date.now()): SignerProof | null {
  const publicKey = headers.get('x-signer-public-key');
  const proof = headers.get('x-signer-proof');
  const timestampHeader = headers.get('x-signer-timestamp');
  if (!publicKey && !proof && !timestampHeader) return null;

  if (!publicKey || !/^0x[0-9a-fA-F]{64}$/.test(publicKey) ||
      !proof || !/^0x[0-9a-fA-F]{128}$/.test(proof) ||
      !timestampHeader || !/^\d{1,12}$/.test(timestampHeader)) {
    throw new SignerProofError('Signer proof is malformed.');
  }
  const timestamp = Number(timestampHeader);
  if (Math.abs(Math.floor(now / 1000) - timestamp) > SIGNER_PROOF_MAX_AGE_SECONDS) {
    throw new SignerProofError('Signer proof expired. Check your device clock and try again.');
  }

  let valid = false;
  try {
    valid = ed25519.verify(fromHex(proof), signerProofMessage(fid, timestamp, host), fromHex(publicKey));
  } catch {
    valid = false;
  }
  if (!valid) throw new SignerProofError('Signer proof signature is invalid.');
  return { publicKeyHex: publicKey.toLowerCase() as `0x${string}`, signatureHex: proof.toLowerCase() };
}

export class SignerProofError extends Error {
  readonly status = 401;
  readonly code = 'INVALID_SIGNER_PROOF';
  constructor(message: string) {
    super(message);
    this.name = 'SignerProofError';
  }
}
