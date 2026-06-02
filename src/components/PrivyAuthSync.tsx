'use client';

/**
 * PrivyAuthSync — runs inside PrivyProvider, syncs Privy Farcaster auth
 * into localStorage under 'hh_profile' (the shape the rest of the app expects).
 * Also fires 'hh:auth:changed' so useNeynarCompat picks up changes immediately.
 */

import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';

export default function PrivyAuthSync() {
  const { authenticated, user, logout } = usePrivy();

  useEffect(() => {
    if (authenticated && user) {
      const farcasterAccount = user.linkedAccounts?.find(
        (a: any) => a.type === 'farcaster'
      ) as any;

      if (farcasterAccount) {
        const profile = {
          fid: farcasterAccount.fid,
          username: farcasterAccount.username || '',
          displayName: farcasterAccount.displayName || farcasterAccount.display_name || '',
          pfpUrl: farcasterAccount.pfp || farcasterAccount.pfp_url || '',
          bio: farcasterAccount.bio || '',
          signer_uuid: farcasterAccount.signerPublicKey || '',
          verified_addresses: {
            eth_addresses: user.linkedAccounts
              ?.filter((a: any) => a.type === 'wallet')
              .map((a: any) => a.address)
              .filter(Boolean) || [],
          },
        };
        localStorage.setItem('hh_profile', JSON.stringify(profile));
      } else {
        // Authenticated but no Farcaster account linked — use basic user info
        const profile = {
          fid: 0,
          username: user.id || '',
          displayName: '',
          pfpUrl: '',
          bio: '',
        };
        localStorage.setItem('hh_profile', JSON.stringify(profile));
        // Signal onboarding component to show account creation flow
        window.dispatchEvent(new Event('hh:need:farcaster-account'));
      }
    } else if (!authenticated) {
      localStorage.removeItem('hh_profile');
    }

    // Notify useNeynarCompat listeners
    window.dispatchEvent(new Event('hh:auth:changed'));
  }, [authenticated, user]);

  return null;
}
