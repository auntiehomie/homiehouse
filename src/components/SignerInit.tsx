'use client';

/**
 * Opens the explicit Hypersnap signer enrollment UI when a user asks to post.
 * Key generation and registration happen only after the user opts in and
 * approves the custody-wallet signature; no mnemonic or Farcaster-app flow.
 */

import { useEffect } from 'react';
import { useFarcasterAuth } from '@/lib/farcaster-auth';

export default function SignerInit() {
  const { fid } = useFarcasterAuth();

  useEffect(() => {
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const requestedFid = Number(detail?.fid || fid);
      if (!requestedFid) return;
      const stored = localStorage.getItem(`signer_${requestedFid}`);
      if (stored) {
        try {
          const signer = JSON.parse(stored);
          if (signer.status === 'approved' && signer.private_key) return;
        } catch { /* continue to the explicit enrollment UI */ }
      }
      window.dispatchEvent(new CustomEvent('showWelcomeModal', { detail: { mode: 'hypersnap' } }));
    };
    window.addEventListener('hh:request:signer', onRequest);
    return () => window.removeEventListener('hh:request:signer', onRequest);
  }, [fid]);

  return null;
}
