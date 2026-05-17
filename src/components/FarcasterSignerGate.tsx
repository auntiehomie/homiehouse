'use client';

import React, { ReactNode, useState } from 'react';
import { useFarcasterWrites } from '@/hooks/useFarcasterWrites';
import { usePrivy } from '@privy-io/react-auth';

interface FarcasterSignerGateProps {
  children: ReactNode;
  /** Fallback UI when no signer — defaults to a simple prompt */
  fallback?: ReactNode;
}

/**
 * FarcasterSignerGate — renders children only when the user has an active
 * Farcaster signer. Otherwise shows a prompt to authorize one via Warpcast.
 *
 * Usage:
 *   <FarcasterSignerGate>
 *     <ComposeBox />
 *   </FarcasterSignerGate>
 */
export function FarcasterSignerGate({ children, fallback }: FarcasterSignerGateProps) {
  const { authenticated, login } = usePrivy();
  const { hasActiveSigner, requestSigner } = useFarcasterWrites();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authenticated) {
    return (
      <div className="farcaster-signer-gate">
        {fallback ?? (
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <p>Sign in to post to Farcaster</p>
            <button
              onClick={() => login()}
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
            <p>Authorize Homiehouse to post on your behalf</p>
            <p style={{ fontSize: '0.875rem', color: '#888', marginTop: '4px' }}>
              This opens Warpcast to approve a non-custodial signer. You stay in control.
            </p>
            {error && <p style={{ color: 'red', marginTop: '8px' }}>{error}</p>}
            <button
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  await requestSigner();
                } catch (e: any) {
                  setError(e?.message ?? 'Failed to request signer');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              style={{ marginTop: '8px', padding: '8px 16px', cursor: loading ? 'wait' : 'pointer' }}
            >
              {loading ? 'Opening Warpcast…' : 'Authorize Signer'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
