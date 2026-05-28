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
  const { hasActiveSigner, requestSigner, signerApprovalUrl, checkSignerStatus } = useFarcasterWrites();
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
              This opens Warpcast to approve a signer. You stay in control.
            </p>
            {error && <p style={{ color: 'red', marginTop: '8px' }}>{error}</p>}
            {!signerApprovalUrl ? (
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
                {loading ? 'Creating…' : 'Authorize Signer'}
              </button>
            ) : (
              <div style={{ marginTop: '8px' }}>
                <a
                  href={signerApprovalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-block', padding: '8px 16px', background: '#ea580c', color: 'white', borderRadius: '6px', textDecoration: 'none', marginBottom: '8px' }}
                >
                  Approve in Warpcast →
                </a>
                <br />
                <button
                  onClick={async () => { setLoading(true); try { await checkSignerStatus(); } finally { setLoading(false); } }}
                  disabled={loading}
                  style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: loading ? 'wait' : 'pointer' }}
                >
                  {loading ? 'Checking…' : 'Check Status'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
