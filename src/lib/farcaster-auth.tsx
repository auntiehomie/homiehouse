'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FarcasterProfile {
  fid: number
  username: string | null
  displayName: string | null
  pfpUrl: string | null
}

export interface FarcasterAuthState {
  fid: number | null
  username: string | null
  displayName: string | null
  pfpUrl: string | null
  isAuthenticated: boolean
  isAuthenticating: boolean
  signIn: (fid: number) => Promise<void>
  signOut: () => void
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const FarcasterAuthContext = createContext<FarcasterAuthState>({
  fid: null,
  username: null,
  displayName: null,
  pfpUrl: null,
  isAuthenticated: false,
  isAuthenticating: false,
  signIn: async () => {},
  signOut: () => {},
})

export function useFarcasterAuth(): FarcasterAuthState {
  return useContext(FarcasterAuthContext)
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function FarcasterAuthProvider({ children }: { children: React.ReactNode }) {
  const [fid, setFid] = useState<number | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [pfpUrl, setPfpUrl] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  // ── Read profile + check signer state ──

  const refreshAuth = useCallback(() => {
    try {
      const sessionRaw = sessionStorage.getItem('hh_session_v1')
      const session = sessionRaw ? JSON.parse(sessionRaw) : null
      const sessionValid = !!session?.fid && Number(session.expiresAt) > Date.now()
      const raw = localStorage.getItem('hh_profile')
      if (raw) {
        const profile = JSON.parse(raw)
        if (profile?.fid && typeof profile.fid === 'number') {
          setFid(profile.fid)
          setUsername(profile.username || null)
          setDisplayName(profile.displayName || null)
          setPfpUrl(profile.pfpUrl || null)

          // Check if signer key exists and is approved
          const signerRaw = localStorage.getItem(`signer_${profile.fid}`)
          if (signerRaw) {
            const signer = JSON.parse(signerRaw)
          setIsAuthenticated(
            (sessionValid && Number(session.fid) === profile.fid) ||
            (signer.status === 'approved' && !!signer.private_key),
          )
          } else {
            setIsAuthenticated(sessionValid && Number(session.fid) === profile.fid)
          }
          return
        }
      }
      if (sessionValid) {
        setFid(Number(session.fid))
        setUsername(null)
        setDisplayName(null)
        setPfpUrl(null)
        setIsAuthenticated(true)
        return
      }
    } catch {
      // corrupted storage — treat as signed-out
    }
    setFid(null)
    setUsername(null)
    setDisplayName(null)
    setPfpUrl(null)
    setIsAuthenticated(false)
  }, [])

  useEffect(() => {
    refreshAuth()

    const onSignerApproved = () => {
      refreshAuth()
      setIsAuthenticating(false)
    }
    const onAuthChanged = () => refreshAuth()

    window.addEventListener('hh:signer:approved', onSignerApproved)
    window.addEventListener('hh:auth:changed', onAuthChanged)
    return () => {
      window.removeEventListener('hh:signer:approved', onSignerApproved)
      window.removeEventListener('hh:auth:changed', onAuthChanged)
    }
  }, [refreshAuth])

  // Revalidate the cached profile against Hypersnap so updated names and PFPs
  // appear without requiring the user to sign out and back in.
  useEffect(() => {
    if (!fid) return;
    let active = true;
    fetch(`/api/profile?fid=${encodeURIComponent(String(fid))}`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((fresh) => {
        if (!active || !fresh?.fid || Number(fresh.fid) !== fid) return;
        try {
          const raw = localStorage.getItem('hh_profile');
          const current = raw ? JSON.parse(raw) : null;
          if (!current || Number(current.fid) !== fid) return;
          const updated = {
            ...current,
            username: fresh.username || current.username || '',
            displayName: fresh.display_name || fresh.username || current.displayName || '',
            pfpUrl: fresh.pfp_url || current.pfpUrl || '',
            bio: fresh.profile?.bio?.text || current.bio || '',
            verified_addresses: fresh.verified_addresses || current.verified_addresses,
          };
          if (JSON.stringify(updated) === JSON.stringify(current)) return;
          localStorage.setItem('hh_profile', JSON.stringify(updated));
          setUsername(updated.username || null);
          setDisplayName(updated.displayName || null);
          setPfpUrl(updated.pfpUrl || null);
          window.dispatchEvent(new Event('hh:profile:updated'));
        } catch {
          // A malformed cached profile should not break a valid session.
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [fid]);

  // ── signIn: fetch profile → trigger signer creation ──

  const signIn = useCallback(async (targetFid: number) => {
    setIsAuthenticating(true)
    try {
      const res = await fetch(`/api/profile?fid=${targetFid}`)
      if (res.ok) {
        const data = await res.json()
        const profile: FarcasterProfile = {
          fid: targetFid,
          username: data.username || null,
          displayName: data.display_name || data.username || null,
          pfpUrl: data.pfp_url || null,
        }
        localStorage.setItem('hh_profile', JSON.stringify(profile))
        setFid(profile.fid)
        setUsername(profile.username)
        setDisplayName(profile.displayName)
        setPfpUrl(profile.pfpUrl)
      }
    } catch {
      // continue with signer creation even if profile fetch fails
    }
    window.dispatchEvent(new CustomEvent('hh:request:signer', { detail: { fid: targetFid } }))
  }, [])

  // ── signOut: clear localStorage state ──

  const signOut = useCallback(() => {
    try {
      const sessionRaw = sessionStorage.getItem('hh_session_v1')
      const session = sessionRaw ? JSON.parse(sessionRaw) : null
      if (session?.token) {
        void fetch('/api/auth/session', {
          method: 'DELETE',
          headers: { 'x-session-token': session.token },
        }).catch(() => {})
      }
      sessionStorage.removeItem('hh_session_v1')
      const raw = localStorage.getItem('hh_profile')
      if (raw) {
        const profile = JSON.parse(raw)
        if (profile?.fid) {
          localStorage.removeItem(`signer_${profile.fid}`)
        }
      }
      localStorage.removeItem('hh_profile')
    } catch {
      // best-effort cleanup
    }
    setFid(null)
    setUsername(null)
    setDisplayName(null)
    setPfpUrl(null)
    setIsAuthenticated(false)
    setIsAuthenticating(false)
    window.dispatchEvent(new Event('hh:auth:changed'))
  }, [])

  return (
    <FarcasterAuthContext.Provider
      value={{
        fid,
        username,
        displayName,
        pfpUrl,
        isAuthenticated,
        isAuthenticating,
        signIn,
        signOut,
      }}
    >
      {children}
    </FarcasterAuthContext.Provider>
  )
}
