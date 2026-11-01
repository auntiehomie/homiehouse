'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount, useSignTypedData, useSwitchChain } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { optimism } from 'wagmi/chains';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { getStoredFid } from '@/lib/client-auth';
import {
  registerHypersnapSigner,
  type KeyAddSigningPayload,
} from '@/lib/hypersnap-signer-client';

export default function WelcomeModal() {
  const { fid: authFid } = useFarcasterAuth();
  const { address, isConnected, chainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChainAsync } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const [show, setShow] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'pending' | 'active'>('idle');
  const [phase, setPhase] = useState<'authorizing' | 'checking' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleShow = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.mode === 'hypersnap') {
        setShow(true);
        setError(null);
        const fid = getStoredFid();
        const raw = fid ? localStorage.getItem(`signer_${fid}`) : null;
        let pending = false;
        try { pending = raw ? JSON.parse(raw)?.status === 'pending_hypersnap' : false; } catch { /* ignore malformed cache */ }
        setStatus(pending ? 'pending' : 'idle');
      }
    };
    const handlePending = () => setStatus('pending');
    window.addEventListener('showWelcomeModal', handleShow);
    window.addEventListener('hh:signer:pending', handlePending);
    return () => {
      window.removeEventListener('showWelcomeModal', handleShow);
      window.removeEventListener('hh:signer:pending', handlePending);
    };
  }, []);

  useEffect(() => {
    if (!show) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const getFocusable = () => dialog?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [];
    getFocusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShow(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [show]);

  const getFid = useCallback((): number | null => {
    if (authFid) return authFid;
    return getStoredFid();
  }, [authFid]);

  const pollForActivation = useCallback(async (fid: number, publicKey: string) => {
    // Hypersnap can accept a key before the read endpoint indexes it. Back off
    // gently instead of issuing a burst of requests or asking the wallet again.
    const delays = [0, 1_000, 1_500, 2_500, 4_000, 6_000, 8_000, 10_000];
    for (const delay of delays) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const response = await fetch(`/api/hypersnap/signer?fid=${fid}&publicKey=${encodeURIComponent(publicKey)}`, { cache: 'no-store' });
        const data = await response.json();
        if (data.ok && data.active) {
          const key = `signer_${fid}`;
          const raw = localStorage.getItem(key);
          if (raw) {
            const signer = JSON.parse(raw);
            signer.status = 'approved';
            signer.registration = 'hypersnap-key-add';
            localStorage.setItem(key, JSON.stringify(signer));
          }
          setStatus('active');
          window.dispatchEvent(new Event('hh:signer:approved'));
          return true;
        }
      } catch { /* retry briefly while Hypersnap commits the key */ }
    }
    setStatus('pending');
    return false;
  }, []);

  async function enablePosting() {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setError(null);
    const fid = getFid();
    if (!fid) {
      setError('Sign in with your wallet first, then enable posting.');
      requestInFlight.current = false;
      return;
    }
    const signerKey = `signer_${fid}`;
    const existingRaw = localStorage.getItem(signerKey);
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw);
        if (existing.status === 'pending_hypersnap' && existing.public_key) {
          setProvisioning(true);
          setPhase('checking');
          const active = await pollForActivation(fid, existing.public_key);
          if (active) setTimeout(() => window.location.reload(), 400);
          setProvisioning(false);
          setPhase(null);
          requestInFlight.current = false;
          return;
        }
      } catch { /* continue with a new explicit authorization */ }
    }
    if (!isConnected || !address) {
      openConnectModal?.();
      requestInFlight.current = false;
      return;
    }

    setProvisioning(true);
    setPhase('authorizing');
    const originalChainId = chainId;
    try {
      // Hypersnap's current KEY_ADD verifier uses chainId 1 in the EIP-712 domain.
      // Switch only for the signature; this is not a transaction and costs no gas.
      if (originalChainId !== 1) await switchChainAsync({ chainId: 1 });
      const result = await registerHypersnapSigner(
        fid,
        address,
        (payload) => signTypedDataAsync(payload as KeyAddSigningPayload),
      );
      localStorage.setItem(`signer_${fid}`, JSON.stringify({
        signer_uuid: null,
        public_key: `0x${result.publicKeyHex}`,
        private_key: result.privateKeyHex,
        status: 'pending_hypersnap',
        registration: 'hypersnap-key-add',
      }));
      window.dispatchEvent(new Event('hh:signer:pending'));
      setPhase('checking');
      const active = await pollForActivation(fid, `0x${result.publicKeyHex}`);
      if (active) {
        setTimeout(() => window.location.reload(), 400);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not enable Hypersnap posting.');
    } finally {
      // Restore the wallet's original chain when possible.
      if (originalChainId && originalChainId !== 1) {
        try { await switchChainAsync({ chainId: originalChainId as typeof optimism.id }); } catch { /* wallet may not expose the prior chain */ }
      }
      setProvisioning(false);
      setPhase(null);
      requestInFlight.current = false;
    }
  }

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={() => setShow(false)}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="hypersnap-posting-title" tabIndex={-1} style={{ maxWidth: 500 }} onClick={(event) => event.stopPropagation()}>
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
          <h3 id="hypersnap-posting-title" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Enable Hypersnap posting</h3>
          <p style={{ color: 'var(--muted-on-dark)', marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>
            Your wallet will authorize a HomieHouse signing key directly with Hypersnap. No recovery phrase, separate app approval, or gas transaction is used.
          </p>
          <div style={{ textAlign: 'left', background: 'var(--bg-dark)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 13, lineHeight: 1.6 }}>
            <strong>Permissions:</strong> casts, cast removal, likes/recasts, and follows.
            <br />
            <strong>Expiry:</strong> 30-day sliding window.
            <br />
            <strong>Wallet:</strong> must be the FID&apos;s custody wallet (EOA).
          </div>
          {error && <p role="alert" style={{ color: '#f87171', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
          {status === 'pending' && !error && (
            <p role="status" style={{ color: 'var(--muted-on-dark)', fontSize: 13, margin: '0 0 12px' }}>
              Authorization was submitted. Hypersnap may take a little while to index it. You can close this and check again later without signing again.
            </p>
          )}
          {phase === 'checking' && <p role="status" aria-live="polite" style={{ color: 'var(--muted-on-dark)', fontSize: 13, margin: '0 0 12px' }}>Checking whether Hypersnap has activated your signer…</p>}
          {status === 'active' && <p role="status" style={{ color: '#22c55e', fontSize: 13 }}>Hypersnap posting is enabled.</p>}
          <button
            className="btn primary"
            onClick={enablePosting}
            disabled={provisioning || status === 'active'}
            style={{ width: '100%', padding: 13 }}
          >
            {phase === 'authorizing' ? 'Waiting for wallet approval…' : phase === 'checking' ? 'Checking Hypersnap…' : status === 'active' ? 'Posting enabled' : status === 'pending' ? 'Check activation status' : isConnected ? 'Authorize Hypersnap signer' : 'Connect wallet'}
          </button>
          <button className="btn" onClick={() => setShow(false)} style={{ width: '100%', marginTop: 8, padding: 11 }}>
            Not now
          </button>
          <p style={{ color: 'var(--muted-on-dark)', fontSize: 11, marginTop: 12 }}>
            The signer key is generated in this browser. HomieHouse never receives your custody private key or recovery phrase.
          </p>
        </div>
      </div>
    </div>
  );
}
