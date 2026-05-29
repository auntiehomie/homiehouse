'use client';

/**
 * SignerInit — runs inside PrivyProvider.
 *
 * On first login (or when no approved signer exists in localStorage) it calls
 * POST /api/signer to create an Ed25519 keypair registered via the app mnemonic,
 * stores the result (including private_key) client-side under `signer_<fid>`,
 * then fires the showWelcomeModal event so the user is prompted to approve in
 * Warpcast.  Polls /api/signer until the status flips to "approved".
 */

import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';

export default function SignerInit() {
  const { authenticated, user } = usePrivy();

  useEffect(() => {
    if (!authenticated || !user) return;

    const farcasterAccount = user.linkedAccounts?.find(
      (a: any) => a.type === 'farcaster'
    ) as any;
    const fid: number = farcasterAccount?.fid;
    if (!fid) return;

    initSigner(fid);

    const onRequest = (e: any) => { if (e.detail?.fid === fid) initSigner(fid); };
    window.addEventListener('hh:request:signer', onRequest);
    return () => window.removeEventListener('hh:request:signer', onRequest);
  }, [authenticated, user]);

  return null;
}

async function initSigner(fid: number) {
  const key = `signer_${fid}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const stored = JSON.parse(raw);
      if (stored.status === 'approved' && stored.private_key) return; // already good

      // Approved but private key was lost (old version of app) — must recreate
      if (stored.status === 'approved' && !stored.private_key) {
        localStorage.removeItem(key);
        // fall through to create a new signer below
      } else if (stored.signer_uuid) {
        // Check if it was approved externally since last visit
        const res = await fetch(`/api/signer?signer_uuid=${stored.signer_uuid}`);
        const data = await res.json();
        if (data.ok && data.status === 'approved') {
          stored.status = 'approved';
          localStorage.setItem(key, JSON.stringify(stored));
          window.dispatchEvent(new Event('hh:signer:approved'));
          return;
        }
        // Still pending — re-show modal
        if (stored.signer_approval_url) {
          window.dispatchEvent(new CustomEvent('showWelcomeModal', {
            detail: { approvalUrl: stored.signer_approval_url },
          }));
        }
        pollForApproval(fid, stored.signer_uuid);
        return;
      }
    }

    // No signer yet — create one
    const res = await fetch('/api/signer', { method: 'POST' });
    const signerData = await res.json();
    if (!signerData.ok) {
      console.error('[SignerInit] Failed to create signer:', signerData.error);
      return;
    }

    localStorage.setItem(key, JSON.stringify({
      signer_uuid: signerData.signer_uuid,
      public_key: signerData.public_key,
      private_key: signerData.private_key,   // stored client-side only
      status: 'pending_approval',
      signer_approval_url: signerData.signer_approval_url,
    }));

    if (signerData.signer_approval_url) {
      window.dispatchEvent(new CustomEvent('showWelcomeModal', {
        detail: { approvalUrl: signerData.signer_approval_url },
      }));
    }
    pollForApproval(fid, signerData.signer_uuid);
  } catch (err) {
    console.error('[SignerInit] Error:', err);
  }
}

function pollForApproval(fid: number, signerUuid: string) {
  const key = `signer_${fid}`;
  let attempts = 0;

  const check = async () => {
    if (attempts >= 72) return; // ~6 min max
    attempts++;
    try {
      const res = await fetch(`/api/signer?signer_uuid=${signerUuid}`);
      const data = await res.json();
      if (data.ok && data.status === 'approved') {
        const raw = localStorage.getItem(key);
        if (raw) {
          const stored = JSON.parse(raw);
          stored.status = 'approved';
          localStorage.setItem(key, JSON.stringify(stored));
        }
        window.dispatchEvent(new Event('hh:signer:approved'));
        return;
      }
    } catch { /* ignore */ }
    setTimeout(check, 5000);
  };
  setTimeout(check, 5000);
}
