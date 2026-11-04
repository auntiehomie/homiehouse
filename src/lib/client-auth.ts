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

const sessionRequests = new Map<number, Promise<FarcasterAuthHeaders | null>>();

/**
 * Return a session header with the requested capability, creating a fresh
 * session from the user's already-approved signer when the current session
 * is missing, expired, or read-only. This is needed after wallet-only login,
 * which intentionally creates a read-only session.
 */
export async function ensureAuthHeaders(requiredScope: string): Promise<FarcasterAuthHeaders | null> {
  const existing = getAuthHeaders(requiredScope);
  if (existing) return existing;

  const fid = getStoredFid();
  const signerKey = getStoredSignerKey();
  if (!fid || !signerKey || typeof window === 'undefined') return null;

  const inFlight = sessionRequests.get(fid);
  if (inFlight) return inFlight;

  const request = (async (): Promise<FarcasterAuthHeaders | null> => {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-farcaster-fid': String(fid),
          'x-signer-key': signerKey,
        },
        body: JSON.stringify({ fid }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok || typeof data.token !== 'string' || Number(data.fid) !== fid) {
        return null;
      }

      const session = { token: data.token, fid, expiresAt: Number(data.expiresAt) };
      if (!Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return null;
      sessionStorage.setItem('hh_session_v1', JSON.stringify(session));
      window.dispatchEvent(new Event('hh:auth:changed'));
      return getAuthHeaders(requiredScope);
    } catch {
      return null;
    } finally {
      sessionRequests.delete(fid);
    }
  })();

  sessionRequests.set(fid, request);
  return request;
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
