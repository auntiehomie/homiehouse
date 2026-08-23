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
 * Farcaster account linked via Privy. Privy manages the Ed25519 signer;
 * no Warpcast approval URL flow needed.
 */
export function FarcasterSignerGate({ children, fallback }: FarcasterSignerGateProps) {
  const { isAuthenticated, signIn, fid } = useFarcasterAuth();
  const { hasActiveSigner, requestSigner } = useFarcasterWrites();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="farcaster-signer-gate">
        {fallback ?? (
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <p>Sign in to post to Farcaster</p>
            <button
              onClick={async () => {
                if (fid) await signIn(fid);
              }}
              style={{ marginTop: '8px', padding: '8px 16px', cursor: 'pointer' }}
            >
              Sign In
            </button>
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
            <p>Connect your Farcaster account to post</p>
            {error && <p style={{ color: 'red', marginTop: '8px' }}>{error}</p>}
            <button
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  await requestSigner();
                } catch (e: any) {
                  setError(e?.message ?? 'Failed to connect Farcaster account');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              style={{ marginTop: '8px', padding: '8px 16px', cursor: loading ? 'wait' : 'pointer' }}
            >
              {loading ? 'Connecting…' : 'Connect Farcaster'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
