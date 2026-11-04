/**
 * client-auth — helper for client-side auth headers.
 *
 * API requests use short-lived session tokens. Signer private keys are never
 * returned by this general-purpose helper.
 *
 * Usage in client components:
 *   const headers = getAuthHeaders(); // or null if not authenticated
 *   fetch('/api/some-authenticated-route', { headers: { ...headers } })
 */

export interface FarcasterAuthHeaders {
  'x-session-token'?: string;
}

/**
 * Return a capable, unexpired session token, or null.
 */
export function getAuthHeaders(requiredScope?: string): FarcasterAuthHeaders | null {
  if (typeof window === 'undefined') return null;

  try {
    const sessionRaw = sessionStorage.getItem('hh_session_v1');
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);
      if (session.token && session.expiresAt > Date.now()) {
        let hasScope = !requiredScope;
        if (requiredScope) {
          try {
            const payload = session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const claims = JSON.parse(atob(payload));
            hasScope = Array.isArray(claims.scopes) && claims.scopes.includes(requiredScope);
          } catch { return null; }
        }
        if (hasScope) return { 'x-session-token': session.token };
      }
    }
    return null;
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
