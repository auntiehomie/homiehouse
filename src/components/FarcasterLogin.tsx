'use client';

/**
 * FarcasterLogin – Farcaster-native login using Hypersnap.
 *
 * Users enter their Farcaster username or FID.
 * 1. App fetches their profile from /api/profile (→ Hypersnap / Warpcast fallback)
 * 2. App stores the profile in localStorage as hh_profile
 * 3. App dispatches hh:auth:changed so FarcasterAuthProvider picks it up
 * 4. App dispatches hh:request:signer so SignerInit creates/checks the signer
 */

import { useState } from 'react';

interface FarcasterLoginProps {
  /** Called after successful login */
  onLogin?: () => void;
  /** Show as inline (false) or modal overlay (true) */
  modal?: boolean;
  /** Called to dismiss the modal */
  onDismiss?: () => void;
}

export default function FarcasterLogin({ onLogin, modal = false, onDismiss }: FarcasterLoginProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Enter a Farcaster username or FID');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Determine if input is an FID (pure number) or username
      const isFid = /^\d+$/.test(trimmed);
      const param = isFid ? `fid=${trimmed}` : `username=${encodeURIComponent(trimmed)}`;

      const res = await fetch(`/api/profile?${param}`);
      if (!res.ok) {
        throw new Error('Profile not found. Check your username or FID.');
      }

      const profile = await res.json();
      if (!profile?.fid) {
        throw new Error('Could not find a Farcaster account for this input.');
      }

      // Store in localStorage (same shape PrivyAuthSync was writing)
      const hhProfile = {
        fid: profile.fid,
        username: profile.username || '',
        displayName: profile.display_name || profile.username || '',
        pfpUrl: profile.pfp_url || '',
        bio: profile.profile?.bio?.text || '',
        signer_uuid: '',
        verified_addresses: profile.verified_addresses || { eth_addresses: [] },
      };
      localStorage.setItem('hh_profile', JSON.stringify(hhProfile));

      // Dispatch auth changed so FarcasterAuthProvider + useNeynarCompat pick it up
      window.dispatchEvent(new Event('hh:auth:changed'));

      // Trigger signer creation / check
      window.dispatchEvent(new CustomEvent('hh:request:signer', { detail: { fid: profile.fid } }));

      onLogin?.();
    } catch (err: any) {
      setError(err.message || 'Failed to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const content = (
    <div style={{ textAlign: 'center' }}>
      {/* Logo */}
      <div style={{ fontSize: 48, marginBottom: 12 }}>🟣</div>
      <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: 'var(--text-on-dark)' }}>
        Sign in to HomieHouse
      </h2>
      <p style={{ color: 'var(--muted-on-dark)', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
        Enter your Farcaster username or FID to get started.
        No wallet connection needed — just your Farcaster identity.
      </p>

      {/* Input */}
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
          placeholder="username or FID (e.g. 1234)"
          autoFocus
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 12,
            fontSize: 16,
            fontFamily: 'monospace',
            border: `1.5px solid ${error ? '#f87171' : 'var(--border)'}`,
            background: 'var(--bg-dark)',
            color: 'var(--text-on-dark)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <p style={{
          color: '#f87171',
          fontSize: 13,
          margin: '0 0 12px',
          padding: '8px 12px',
          background: 'rgba(248,113,113,0.1)',
          borderRadius: 8,
          textAlign: 'left',
        }}>
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        onClick={handleLogin}
        disabled={loading || !input.trim()}
        style={{
          width: '100%',
          padding: 14,
          borderRadius: 12,
          border: 'none',
          background: loading || !input.trim() ? 'var(--border)' : 'var(--btn-primary-bg, #6366f1)',
          color: loading || !input.trim() ? 'var(--muted-on-dark)' : 'var(--btn-primary-color, #fff)',
          fontSize: 15,
          fontWeight: 700,
          cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Looking you up…' : 'Sign in →'}
      </button>

      {/* No signup? Create account prompt */}
      <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginTop: 16 }}>
        Don&apos;t have a Farcaster account?{' '}
        <button
          onClick={() => {
            window.dispatchEvent(new Event('hh:need:farcaster-account'));
            onDismiss?.();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent, #6366f1)',
            cursor: 'pointer',
            fontSize: 12,
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          Create one
        </button>
      </p>
    </div>
  );

  if (!modal) {
    return (
      <div style={{
        maxWidth: 400,
        width: '100%',
        margin: '40px auto',
        padding: '32px 28px',
        background: 'var(--surface)',
        borderRadius: 24,
        border: '1px solid var(--border)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
      }}>
        {content}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onDismiss}
    >
      <div
        style={{
          maxWidth: 400,
          width: '100%',
          padding: '32px 28px',
          background: 'var(--surface)',
          borderRadius: 24,
          border: '1px solid var(--border)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
}