'use client';

/**
 * Publish profile fields (USER_DATA_ADD) with the user's scoped Hypersnap
 * signer, so other clients see them. Native Hypersnap accounts have no fname,
 * so the display name is how people recognise them.
 *
 * Needs a signer whose scopes include USER_DATA_ADD (11). Signers created
 * before that scope was added are rejected by the node with a scope error.
 */

import { ed25519 } from '@noble/curves/ed25519';
import { ensureAuthHeaders } from '@/lib/client-auth';
import { buildSignedMessage, hexToBytes, MessageType, UserDataType } from '@/lib/fc-message-builder';

/** Hypersnap's limit for USER_DATA_ADD display names, in bytes. */
export const MAX_DISPLAY_NAME_BYTES = 32;

export async function buildDisplayNameMessage(
  fid: number,
  displayName: string,
  signerPrivateKeyHex: string,
): Promise<Uint8Array> {
  const value = displayName.trim();
  if (!value || new TextEncoder().encode(value).length > MAX_DISPLAY_NAME_BYTES) {
    throw new Error(`Display names must be 1–${MAX_DISPLAY_NAME_BYTES} bytes.`);
  }
  const privateKey = hexToBytes(signerPrivateKeyHex);
  return buildSignedMessage(
    { type: MessageType.USER_DATA_ADD, fid, body: { userDataBody: { type: UserDataType.DISPLAY, value } } },
    { publicKey: ed25519.getPublicKey(privateKey), sign: async (hash) => ed25519.sign(hash, privateKey) },
  );
}

/**
 * Sign and submit a display name. Returns an error message instead of
 * throwing, and never opens the posting-authorization prompt, so callers such
 * as onboarding can treat it as best-effort.
 */
export async function publishDisplayName(
  fid: number,
  displayName: string,
  signerPrivateKeyHex: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const message = await buildDisplayNameMessage(fid, displayName, signerPrivateKeyHex);
    const auth = await ensureAuthHeaders('write:casts');
    if (!auth) return { ok: false, error: 'HomieHouse could not start a posting session yet.' };
    const res = await fetch('/api/submit-cast', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream', ...auth },
      body: message as unknown as BodyInit,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      return { ok: false, error: data?.details || data?.error || `Hypersnap rejected the profile update (${res.status}).` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
