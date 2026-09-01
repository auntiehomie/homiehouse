'use client';

/**
 * Farcaster auth context hook.
 * Reads the user's Farcaster profile from localStorage (hh_profile)
 * which is populated by Farcaster auth on login.
 *
 * Usage: import { useFarcasterUser } from '@/hooks/useFarcasterUser';
 */

import { useState, useEffect } from 'react';

interface FarcasterAuthUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  profile?: { bio?: { text?: string } };
  signer_uuid?: string;
  verified_addresses?: { eth_addresses?: string[] };
}

interface FarcasterAuthContext {
  user: FarcasterAuthUser | null;
  isAuthenticated: boolean;
}

export function useFarcasterUser(): FarcasterAuthContext {
  const [user, setUser] = useState<FarcasterAuthUser | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('hh_profile');
      if (stored) {
        const profile = JSON.parse(stored);
        if (profile?.fid) return {
          fid: profile.fid,
          username: profile.username || '',
          display_name: profile.displayName || profile.display_name || '',
          pfp_url: profile.pfpUrl || profile.pfp_url || '',
          profile: { bio: { text: profile.bio || '' } },
          signer_uuid: profile.signer_uuid,
          verified_addresses: profile.verified_addresses,
        };
      }
    } catch {}
    return null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem('hh_profile');
      const profile = stored ? JSON.parse(stored) : null;
      return !!(profile?.fid);
    } catch { return false; }
  });

  useEffect(() => {
    const readProfile = () => {
      try {
        const stored = localStorage.getItem('hh_profile');
        if (stored) {
          const profile = JSON.parse(stored);
          if (profile?.fid) {
            setUser({
              fid: profile.fid,
              username: profile.username || '',
              display_name: profile.displayName || profile.display_name || '',
              pfp_url: profile.pfpUrl || profile.pfp_url || '',
              profile: { bio: { text: profile.bio || '' } },
              signer_uuid: profile.signer_uuid,
              verified_addresses: profile.verified_addresses,
            });
            setIsAuthenticated(true);
            return;
          }
        }
      } catch {
        // ignore parse errors
      }
      setUser(null);
      setIsAuthenticated(false);
    };

    readProfile();

    // Listen for storage events (cross-tab logout/login)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'hh_profile') readProfile();
    };
    window.addEventListener('storage', handleStorage);

    // Listen for custom auth events dispatched by FarcasterLogin
    const handleAuthChange = () => readProfile();
    window.addEventListener('hh:auth:changed', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('hh:auth:changed', handleAuthChange);
    };
  }, []);

  return { user, isAuthenticated };
}
