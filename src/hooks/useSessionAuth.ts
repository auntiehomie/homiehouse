/**
 * Client-side session auth hook
 *
 * Manages the full session lifecycle:
 *   1. Challenge → GET /api/auth/challenge
 *   2. Sign challenge with Farcaster signer
 *   3. Verify → POST /api/auth/verify (Hypersnap)
 *   4. Session → POST /api/auth/session → get JWT
 *   5. Use x-session-token on subsequent API calls
 *   6. Auto-refresh before expiry
 */

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

interface SessionState {
  token: string | null;
  fid: number | null;
  expiresAt: number | null;
  status: 'unauthenticated' | 'authenticating' | 'authenticated' | 'error';
  error: string | null;
}

const SESSION_STORAGE_KEY = 'hh_session_v1';

function loadStoredSession(): { token: string; fid: number; expiresAt: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.expiresAt < Date.now()) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function storeSession(token: string, fid: number, expiresAt: number): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ token, fid, expiresAt }),
    );
  } catch {
    // sessionStorage might be full or unavailable
  }
}

function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // noop
  }
}

/**
 * Hook for session-based auth (HH-02 P1).
 *
 * The session token is stored in sessionStorage (cleared on tab close).
 * Auto-refreshes the JWT within the 1-hour refresh window.
 */
export function useSessionAuth() {
  const [state, setState] = useState<SessionState>(() => {
    const stored = loadStoredSession();
    if (stored) {
      return {
        token: stored.token,
        fid: stored.fid,
        expiresAt: stored.expiresAt,
        status: 'authenticated',
        error: null,
      };
    }
    return {
      token: null,
      fid: null,
      expiresAt: null,
      status: 'unauthenticated',
      error: null,
    };
  });

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-refresh
  useEffect(() => {
    if (!state.token || !state.expiresAt || state.status !== 'authenticated') return;

    const refreshMs = state.expiresAt - Date.now() - 55 * 60 * 1000; // 5 min before expiry
    if (refreshMs <= 0) {
      // Already past refresh point — refresh now
      refreshSessionToken(state.token).then((result) => {
        if (result) {
          setState((prev) => ({
            ...prev,
            token: result.token,
            expiresAt: result.expiresAt,
          }));
        }
      }).catch(() => {
        // Refresh failed — session may be expired
        setState({
          token: null,
          fid: null,
          expiresAt: null,
          status: 'unauthenticated',
          error: null,
        });
      });
      return;
    }

    refreshTimerRef.current = setTimeout(() => {
      if (!state.token) return;
      refreshSessionToken(state.token).then((result) => {
        if (result) {
          setState((prev) => ({
            ...prev,
            token: result.token,
            expiresAt: result.expiresAt,
          }));
        }
      }).catch(() => {
        setState({
          token: null,
          fid: null,
          expiresAt: null,
          status: 'unauthenticated',
          error: null,
        });
      });
    }, refreshMs);

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [state.token, state.expiresAt, state.status]);

  /**
   * Create a session from an existing authed FID.
   * Used during onboarding or signer registration to upgrade to session-based auth.
   */
  const createSession = useCallback(async (fid: number): Promise<boolean> => {
    setState((prev) => ({ ...prev, status: 'authenticating', error: null }));
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fid }),
      });
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to create session');
      }
      storeSession(data.token, data.fid, data.expiresAt);
      setState({
        token: data.token,
        fid: data.fid,
        expiresAt: data.expiresAt,
        status: 'authenticated',
        error: null,
      });
      return true;
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: err?.message || 'Failed to create session',
      }));
      return false;
    }
  }, []);

  /**
   * Revoke the current session (logout).
   */
  const destroySession = useCallback(async (): Promise<void> => {
    const { token } = state;
    if (token) {
      try {
        await fetch('/api/auth/session', {
          method: 'DELETE',
          headers: { 'x-session-token': token },
        });
      } catch {
        // Best effort
      }
    }
    clearStoredSession();
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    setState({
      token: null,
      fid: null,
      expiresAt: null,
      status: 'unauthenticated',
      error: null,
    });
  }, [state.token]);

  /**
   * Get auth headers for API calls.
   * Prefers session token; falls back to signer key for legacy compat.
   */
  const getAuthHeaders = useCallback((
    legacyFid?: number,
    legacySignerKey?: string,
  ): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (state.token) {
      headers['x-session-token'] = state.token;
    }
    if (legacyFid && legacySignerKey) {
      headers['x-farcaster-fid'] = String(legacyFid);
      headers['x-signer-key'] = legacySignerKey;
    }
    return headers;
  }, [state.token]);

  return {
    ...state,
    createSession,
    destroySession,
    getAuthHeaders,
    isAuthenticated: state.status === 'authenticated',
  };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function refreshSessionToken(
  oldToken: string,
): Promise<{ token: string; expiresAt: number } | null> {
  const res = await fetch('/api/auth/session', {
    method: 'PUT',
    headers: { 'x-session-token': oldToken },
  });
  const data = await res.json();
  if (!data.ok) return null;
  if (data.refreshed && data.token) {
    storeSession(data.token, data.fid ?? 0, data.expiresAt);
    return { token: data.token, expiresAt: data.expiresAt };
  }
  return null;
}