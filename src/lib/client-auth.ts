/**
 * client-auth — helper for client-side auth headers.
 *
 * Provides Farcaster signer-key-based auth headers for authenticated API calls.
 *
 * Usage in client components:
 *   const headers = getAuthHeaders(); // or null if not authenticated
 *   fetch('/api/some-authenticated-route', { headers: { ...headers } })
 */

export interface FarcasterAuthHeaders {
  'x-farcaster-fid': string;
  'x-signer-key': string;
}

/**
 * Read the FID and signer key from localStorage.
 * Returns null if not authenticated.
 */
export function getAuthHeaders(): FarcasterAuthHeaders | null {
  if (typeof window === 'undefined') return null;

  try {
    const profileRaw = localStorage.getItem('hh_profile');
    if (!profileRaw) return null;
    const profile = JSON.parse(profileRaw);
    const fid = profile?.fid;
    if (!fid || typeof fid !== 'number') return null;

    const signerRaw = localStorage.getItem(`signer_${fid}`);
    if (!signerRaw) return null;
    const signer = JSON.parse(signerRaw);
    if (signer.status !== 'approved' || !signer.private_key) return null;

    return {
      'x-farcaster-fid': String(fid),
      'x-signer-key': signer.private_key,
    };
  } catch {
    return null;
  }
}

/**
 * Get the FID from localStorage only (doesn't require a signer).
 */
export function getStoredFid(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('hh_profile');
    if (!raw) return null;
    const profile = JSON.parse(raw);
    return profile?.fid && typeof profile.fid === 'number' ? profile.fid : null;
  } catch {
    return null;
  }
}

/**
 * Get the signer private key hex for the currently logged-in FID.
 */
export function getStoredSignerKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const fid = getStoredFid();
    if (!fid) return null;
    const raw = localStorage.getItem(`signer_${fid}`);
    if (!raw) return null;
    const signer = JSON.parse(raw);
    return signer.status === 'approved' && signer.private_key ? signer.private_key : null;
  } catch {
    return null;
  }
}