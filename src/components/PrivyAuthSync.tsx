'use client';

/**
 * PrivyAuthSync — runs inside PrivyProvider, syncs Privy Farcaster auth
 * into localStorage under 'hh_profile' (the shape the rest of the app expects).
 * Also fires 'hh:auth:changed' so useNeynarCompat picks up changes immediately.
 */

import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';

export default function PrivyAuthSync() {
  const { ready, authenticated, user } = usePrivy();

  useEffect(() => {
    // Wait until Privy has finished loading its session before touching
    // localStorage. Without this guard, `authenticated` starts as false
    // on every page load/refresh, causing a premature removal of
    // hh_profile and a visible flash to the landing page.
    if (!ready) return;

    if (authenticated && user) {
      const farcasterAccount = user.linkedAccounts?.find(
        (a: any) => a.type === 'farcaster'
      ) as any;

      if (farcasterAccount) {
        // Privy exposes the Farcaster custody address as ownerAddress or custodyAddress
        const custodyAddress: string =
          (farcasterAccount as any).ownerAddress ||
          (farcasterAccount as any).custodyAddress ||
          '';

        const linkedWallets: string[] = user.linkedAccounts
          ?.filter((a: any) => a.type === 'wallet')
          .map((a: any) => a.address as string)
          .filter(Boolean) || [];

        // Prefer custody address first so mini-apps get the Farcaster-native wallet
        const ethAddresses = [
          ...(custodyAddress ? [custodyAddress] : []),
          ...linkedWallets.filter(a => a.toLowerCase() !== custodyAddress.toLowerCase()),
        ];

        const profile = {
          fid: farcasterAccount.fid,
          username: farcasterAccount.username || '',
          displayName: farcasterAccount.displayName || farcasterAccount.display_name || '',
          pfpUrl: farcasterAccount.pfp || farcasterAccount.pfp_url || '',
          bio: farcasterAccount.bio || '',
          signer_uuid: farcasterAccount.signerPublicKey || '',
          custody_address: custodyAddress,
          verified_addresses: { eth_addresses: ethAddresses },
        };
        localStorage.setItem('hh_profile', JSON.stringify(profile));
      } else {
        const profile = {
          fid: 0,
          username: user.id || '',
          displayName: '',
          pfpUrl: '',
          bio: '',
        };
        localStorage.setItem('hh_profile', JSON.stringify(profile));
        window.dispatchEvent(new Event('hh:need:farcaster-account'));
      }
    } else if (!authenticated) {
      localStorage.removeItem('hh_profile');
    }

    window.dispatchEvent(new Event('hh:auth:changed'));
  }, [ready, authenticated, user]);

  return null;
}
