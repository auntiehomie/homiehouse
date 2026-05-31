import { ed25519 } from '@noble/curves/ed25519';

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlStr(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export interface JfsParams {
  fid: number;
  privateKeyHex: string;
  inputs: Record<string, unknown>;
  snapUrl: string;
  surface?: 'cast' | 'standalone';
}

/** Build a JSON Farcaster Signature (JFS) token for a Snap POST request. */
export function buildJfs(params: JfsParams): string {
  const { fid, privateKeyHex, inputs, snapUrl, surface = 'cast' } = params;
  const privateKeyBytes = hexToBytes(privateKeyHex);
  const publicKeyBytes = ed25519.getPublicKey(privateKeyBytes);

  const header = { fid, type: 'app_key', key: base64url(publicKeyBytes) };
  const payload = {
    fid,
    inputs,
    timestamp: Math.floor(Date.now() / 1000),
    audience: new URL(snapUrl).origin,
    user: { fid },
    surface: { type: surface },
  };

  const encodedHeader = base64urlStr(JSON.stringify(header));
  const encodedPayload = base64urlStr(JSON.stringify(payload));
  const signingInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = ed25519.sign(signingInput, privateKeyBytes);

  return `${encodedHeader}.${encodedPayload}.${base64url(signature)}`;
}

/** Extract signer info from localStorage for a given FID. */
export function getSignerForFid(fid: number): { privateKeyHex: string } | null {
  try {
    const raw = localStorage.getItem(`signer_${fid}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.status !== 'approved' || !data.private_key) return null;
    return { privateKeyHex: data.private_key };
  } catch {
    return null;
  }
}
