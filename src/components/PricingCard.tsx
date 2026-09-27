'use client';

import { useState, useCallback } from 'react';

interface PricingCardProps {
  userFid?: number | null;
  isPro?: boolean;
}

export default function PricingCard({ userFid, isPro = false }: PricingCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const features = [
    { icon: '💬', label: 'Unlimited Ask Homie queries' },
    { icon: '🔬', label: 'Deeper research mode' },
    { icon: '⚡', label: 'Priority LLM routing' },
    { icon: '🎨', label: 'All premium cast themes' },
    { icon: '📋', label: 'Extra list creation slots' },
  ];

  const handleSubscribe = useCallback(async () => {
    if (!userFid) return;
    setLoading(true);
    setError(null);

    try {
      // Read auth from local storage
      const profile = localStorage.getItem('hh_profile');
      const p = profile ? JSON.parse(profile) : null;
      const fid = String(p?.fid || '');
      const signerRaw = fid ? localStorage.getItem(`signer_${fid}`) : null;
      const signerKey = signerRaw ? JSON.parse(signerRaw)?.private_key : null;

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(fid ? { 'x-farcaster-fid': fid } : {}),
          ...(signerKey ? { 'x-signer-key': signerKey } : {}),
        },
      });

      const data = await res.json();
      if (!data.ok || !data.url) {
        setError(data.error || 'Failed to start checkout');
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [userFid]);

  const handleManage = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const profile = localStorage.getItem('hh_profile');
      const p = profile ? JSON.parse(profile) : null;
      const fid = String(p?.fid || '');
      const signerRaw = fid ? localStorage.getItem(`signer_${fid}`) : null;
      const signerKey = signerRaw ? JSON.parse(signerRaw)?.private_key : null;

      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(fid ? { 'x-farcaster-fid': fid } : {}),
          ...(signerKey ? { 'x-signer-key': signerKey } : {}),
        },
      });

      const data = await res.json();
      if (!data.ok || !data.url) {
        setError(data.error || 'Failed to open billing portal');
        return;
      }

      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: isPro ? '2px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
        maxWidth: 380,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 20px 16px',
          background: isPro
            ? 'linear-gradient(135deg, rgba(232,119,34,0.15), rgba(232,119,34,0.05))'
            : 'linear-gradient(135deg, rgba(255,255,255,0.05), transparent)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 6 }}>
          HomieHouse Pro
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-on-dark)', marginBottom: 2 }}>
          $5<span style={{ fontSize: 16, fontWeight: 500, color: 'var(--muted-on-dark)' }}>/mo</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>
          Cancel anytime
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-on-dark)', marginBottom: 12 }}>
          Everything in Free, plus:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.3 }}>{f.icon}</span>
              <span style={{ fontSize: 13, color: 'var(--muted-on-dark)', lineHeight: 1.5 }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 20px 20px' }}>
        {isPro ? (
          <>
            <div
              style={{
                width: '100%', padding: '12px', borderRadius: 10, textAlign: 'center',
                background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                fontSize: 14, fontWeight: 700, marginBottom: 8,
              }}
            >
              � You&apos;re a Pro member
            </div>
            <button
              onClick={handleManage}
              disabled={loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 10,
                background: 'var(--accent)', color: '#fff',
                border: 'none', fontWeight: 700, fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Loading...' : 'Manage Subscription'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleSubscribe}
              disabled={loading || !userFid}
              style={{
                width: '100%', padding: '12px', borderRadius: 10,
                background: userFid ? 'var(--accent)' : 'var(--surface)',
                color: userFid ? '#fff' : 'var(--muted-on-dark)',
                border: userFid ? 'none' : '1px solid var(--border)',
                fontWeight: 700, fontSize: 14,
                cursor: userFid && !loading ? 'pointer' : 'not-allowed',
                opacity: userFid && !loading ? 1 : 0.6,
              }}
            >
              {loading ? 'Redirecting to Stripe...' : userFid ? 'Subscribe — $5/mo' : 'Sign in to Subscribe'}
            </button>
          </>
        )}
        {error && (
          <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', marginTop: 8 }}>
            {error}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--muted-on-dark)', textAlign: 'center', marginTop: 8 }}>
          Secure billing via Stripe · Cancel anytime
        </div>
      </div>
    </div>
  );
}