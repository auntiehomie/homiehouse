import { fetchFromHypersnapNodes } from './hypersnap-nodes';

export type HypersnapSignerStatus = 'active' | 'inactive' | 'unavailable';

/**
 * Check a derived public key against Hypersnap's unified active signer index,
 * trying the personal node first and then the fallback nodes.
 *
 * Returns 'unavailable' (not 'inactive') when no node gave a usable answer,
 * so callers can tell "this key is not approved" apart from "Hypersnap is
 * slow right now" and avoid sending the user through signer renewal.
 */
export async function checkHypersnapSigner(fid: number, publicKeyHex: string): Promise<HypersnapSignerStatus> {
  const key = publicKeyHex.replace(/^0x/i, '').toLowerCase();
  const query = new URLSearchParams({ fid: String(fid), signer: key });

  let response: Response;
  try {
    ({ response } = await fetchFromHypersnapNodes(`/v1/signer?${query}`, {
      timeoutMs: 5_000,
      label: 'signer-auth',
    }));
  } catch {
    return 'unavailable';
  }

  if (response.status === 404) return 'inactive';
  if (!response.ok) return 'unavailable';

  try {
    const { signer } = await response.json();
    if (!signer || signer.fid !== fid || signer.keyType !== 1 ||
        typeof signer.key !== 'string' || signer.key.replace(/^0x/i, '').toLowerCase() !== key ||
        !['SIGNER_SOURCE_ONCHAIN', 'SIGNER_SOURCE_OFFCHAIN'].includes(signer.source)) return 'inactive';

    // Offchain keys can expire. Do not promote them into the permanent legacy
    // approval cache: query the node again on the next signer-auth request.
    if (signer.expiresAt != null &&
        (!Number.isSafeInteger(signer.expiresAt) || signer.expiresAt <= Math.floor(Date.now() / 1000))) return 'inactive';
    return 'active';
  } catch {
    // Malformed responses must never authorize a request.
    return 'unavailable';
  }
}

/** Verify a derived public key is active. Node outages never authorize a request. */
export async function isActiveHypersnapSigner(fid: number, publicKeyHex: string): Promise<boolean> {
  return (await checkHypersnapSigner(fid, publicKeyHex)) === 'active';
}
