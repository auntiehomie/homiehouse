'use client';

/**
 * Compatibility shim: replaces `useNeynarContext` from @neynar/react.
 * Components that used Neynar's context now read from localStorage (hh_profile)
 * which is populated by Privy auth on login.
 *
 * Usage: import { useNeynarContext } from '@/hooks/useNeynarCompat';
 */

import { useState, useEffect } from 'react';

interface NeynarCompatUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  profile?: { bio?: { text?: string } };
  signer_uuid?: string;
  verified_addresses?: { eth_addresses?: string[] };
}

interface NeynarCompatContext {
  user: NeynarCompatUser | null;
  isAuthenticated: boolean;
}

export function useNeynarContext(): NeynarCompatContext {
  const [user, setUser] = useState<NeynarCompatUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

    // Listen for custom auth events dispatched by PrivyAuthSync
    const handleAuthChange = () => readProfile();
    window.addEventListener('hh:auth:changed', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('hh:auth:changed', handleAuthChange);
    };
  }, []);

  return { user, isAuthenticated };
}
