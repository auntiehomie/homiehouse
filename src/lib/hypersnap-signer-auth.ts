/** Verify a derived public key against Hypersnap's unified active signer index. */
export async function isActiveHypersnapSigner(fid: number, publicKeyHex: string): Promise<boolean> {
  const hub = process.env.NEXT_PUBLIC_HYPERSNAP_URL || 'https://haatz.quilibrium.com';
  const key = publicKeyHex.replace(/^0x/i, '').toLowerCase();
  const url = new URL('/v1/signer', hub);
  url.searchParams.set('fid', String(fid));
  url.searchParams.set('signer', key);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return false;
    const { signer } = await response.json();
    if (!signer || signer.fid !== fid || signer.keyType !== 1 ||
        typeof signer.key !== 'string' || signer.key.replace(/^0x/i, '').toLowerCase() !== key ||
        !['SIGNER_SOURCE_ONCHAIN', 'SIGNER_SOURCE_OFFCHAIN'].includes(signer.source)) return false;

    // Offchain keys can expire. Do not promote them into the permanent legacy
    // approval cache: query the node again on the next signer-auth request.
    if (signer.expiresAt != null &&
        (!Number.isSafeInteger(signer.expiresAt) || signer.expiresAt <= Math.floor(Date.now() / 1000))) return false;
    return true;
  } catch {
    // Node outages or malformed responses must never authorize a request.
    return false;
  }
}
