'use client';

/**
 * EmailSignUp — Client component for email-based sign-up / sign-in using
 * magic links. Calls POST /api/auth/magic-link with the email and shows
 * loading, success, and error states.
 *
 * Includes "Continue with Farcaster" secondary option.
 * Styled to match the existing dark theme.
 */

import { useState, useCallback } from 'react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ── Props ────────────────────────────────────────────────────────────────────

interface EmailSignUpProps {
  /** Called when user wants to switch to Farcaster sign-in */
  onFarcasterConnect?: () => void;
  /** Custom className for the container */
  className?: string;
}

// ── States ───────────────────────────────────────────────────────────────────

type FormState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; email: string }
  | { type: 'error'; message: string };

// ── Component ────────────────────────────────────────────────────────────────

export default function EmailSignUp({
  onFarcasterConnect,
  className,
}: EmailSignUpProps) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>({ type: 'idle' });

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmed = email.trim().toLowerCase();

      if (!isValidEmail(trimmed)) {
        setState({ type: 'error', message: 'Please enter a valid email address.' });
        return;
      }

      setState({ type: 'loading' });

      try {
        const res = await fetch('/api/auth/magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed }),
        });

        if (!res.ok && res.status !== 200) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || 'Something went wrong. Try again.');
        }

        setState({ type: 'success', email: trimmed });
      } catch (err: any) {
        setState({ type: 'error', message: err?.message || 'Something went wrong. Try again.' });
      }
    },
    [email]
  );

  const reset = useCallback(() => {
    setEmail('');
    setState({ type: 'idle' });
  }, []);

  // ── Styles ──────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    maxWidth: 420,
    width: '100%',
    background: 'var(--surface, #1C1C1C)',
    border: '1px solid var(--border, rgba(255,255,255,0.08))',
    borderRadius: 16,
    padding: '2rem 1.75rem',
    fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
    ...(className ? {} : {}),
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: '#fff',
    fontSize: '0.9375rem',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'linear-gradient(180deg, #334155 0%, #1e293b 100%)',
    color: '#e2e8f0',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: '0.9375rem',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'transparent',
    color: 'rgba(255,255,255,0.5)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    fontWeight: 500,
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'color 0.15s, border-color 0.15s',
  };

  // ── Success state ───────────────────────────────────────────────────────

  if (state.type === 'success') {
    return (
      <div style={containerStyle}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            fontSize: '1.5rem',
          }}
        >
          ✉️
        </div>
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            textAlign: 'center',
            color: '#fff',
            margin: '0 0 0.5rem',
          }}
        >
          Check your email
        </h2>
        <p
          style={{
            fontSize: '0.9375rem',
            color: 'rgba(255,255,255,0.65)',
            textAlign: 'center',
            lineHeight: 1.6,
            margin: '0 0 1rem',
          }}
        >
          We sent a sign-in link to{' '}
          <strong style={{ color: 'rgba(255,255,255,0.85)' }}>{state.email}</strong>
        </p>

        <button type="button" onClick={reset} style={secondaryButtonStyle}>
          ← Use a different email
        </button>
      </div>
    );
  }

  // ── Form (idle / loading / error) ───────────────────────────────────────

  return (
    <div style={containerStyle}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem',
          fontSize: '1.5rem',
        }}
      >
        🏠
      </div>
      <h2
        style={{
          fontSize: '1.375rem',
          fontWeight: 600,
          textAlign: 'center',
          color: '#fff',
          margin: '0 0 0.375rem',
        }}
      >
        Welcome to HomieHouse
      </h2>
      <p
        style={{
          fontSize: '0.9375rem',
          color: 'rgba(255,255,255,0.55)',
          textAlign: 'center',
          lineHeight: 1.5,
          margin: '0 0 1.5rem',
        }}
      >
        Enter your email to sign in or create an account.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state.type === 'error') setState({ type: 'idle' });
          }}
          placeholder="you@example.com"
          required
          autoComplete="email"
          disabled={state.type === 'loading'}
          style={{
            ...inputStyle,
            ...(state.type === 'error'
              ? { borderColor: 'rgba(239, 68, 68, 0.4)' }
              : {}),
          }}
        />

        {state.type === 'error' && (
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'rgba(239, 68, 68, 0.85)',
              margin: '0',
            }}
          >
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={state.type === 'loading'}
          style={{
            ...buttonStyle,
            ...(state.type === 'loading' ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
          }}
        >
          {state.type === 'loading' ? 'Sending link…' : 'Send sign-in link'}
        </button>

        {onFarcasterConnect && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                margin: '0.25rem 0',
              }}
            >
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            </div>

            <button
              type="button"
              onClick={onFarcasterConnect}
              style={secondaryButtonStyle}
            >
              🔵 Continue with Farcaster
            </button>
          </>
        )}
      </form>
    </div>
  );
}