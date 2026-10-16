'use client';

import React, { ReactNode, useState } from 'react';
import { useFarcasterWrites } from '@/hooks/useFarcasterWrites';
import { useFarcasterAuth } from '@/lib/farcaster-auth';

interface FarcasterSignerGateProps {
  children: ReactNode;
  /** Fallback UI when no signer — defaults to a simple prompt */
  fallback?: ReactNode;
}

/**
 * FarcasterSignerGate — renders children only when the user has an active
 * Farcaster account linked via FarcasterAuthProvider. App manages the Ed25519 signer;
 * no Warpcast approval URL flow needed.
 */
export function FarcasterSignerGate({ children, fallback }: FarcasterSignerGateProps) {
  const { isAuthenticated } = useFarcasterAuth();
  const { hasActiveSigner, requestSigner } = useFarcasterWrites();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="farcaster-signer-gate">
        {fallback ?? (
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <p>Sign in with a wallet linked to your account to continue.</p>
            <p style={{ fontSize: 12, opacity: 0.75 }}>Use the wallet sign-in control in the app menu. Entering an FID alone is not authentication.</p>
          </div>
        )}
      </div>
    );
  }

  if (!hasActiveSigner) {
    return (
      <div className="farcaster-signer-gate">
        {fallback ?? (
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <p>Enable Hypersnap posting for your account</p>
            {error && <p style={{ color: 'red', marginTop: '8px' }}>{error}</p>}
            <button
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  await requestSigner();
                } catch (e: any) {
                  setError(e?.message ?? 'Failed to enable Hypersnap posting');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              style={{ marginTop: '8px', padding: '8px 16px', cursor: loading ? 'wait' : 'pointer' }}
            >
              {loading ? 'Opening…' : 'Enable Hypersnap posting'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
