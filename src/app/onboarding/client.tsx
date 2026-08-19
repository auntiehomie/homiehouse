'use client';

/**
 * Onboarding Client — Renders the "Are you new to Farcaster?" choice screen.
 * Two paths: "I'm new" → profile setup, "I have Farcaster" → connect existing.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setIdentityMode } from '@/lib/onboarding-storage';

interface OnboardingClientProps {
  userId: number;
  email: string;
}

export default function OnboardingClient({ userId, email }: OnboardingClientProps) {
  const router = useRouter();
  const [choosing, setChoosing] = useState<'new' | 'existing' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChoice(mode: 'new' | 'existing_connected') {
    setChoosing(mode === 'existing_connected' ? 'existing' : 'new');
    setError(null);

    try {
      // Call the API to record the choice
      const res = await fetch('/api/auth/onboarding-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, identityMode: mode }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Something went wrong');
      }

      if (mode === 'existing_connected') {
        // Navigate to connect-existing flow
        router.push('/onboarding/connect');
      } else {
        // Navigate to new-user profile setup
        router.push('/onboarding/profile');
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Try again.');
      setChoosing(null);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--background, #111)',
        color: 'var(--foreground, #fff)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: '100%',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.75rem',
            }}
          >
            🏠
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#fff',
              margin: '0 0 0.375rem',
            }}
          >
            Welcome to HomieHouse
          </h1>
          <p
            style={{
              fontSize: '0.9375rem',
              color: 'rgba(255,255,255,0.5)',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Your home on Farcaster. Let&apos;s get you set up.
          </p>
        </div>

        {/* Choice cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* "I'm new" card */}
          <button
            type="button"
            onClick={() => handleChoice('new')}
            disabled={choosing !== null}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
              padding: '1.5rem',
              background: 'var(--surface, #1C1C1C)',
              border: '1px solid var(--border, rgba(255,255,255,0.08))',
              borderRadius: 14,
              cursor: choosing !== null ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.15s, background 0.15s',
              opacity: choosing === 'existing' ? 0.5 : 1,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(136, 119, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                flexShrink: 0,
              }}
            >
              ✨
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', margin: '0 0 0.25rem' }}>
                I&apos;m new to Farcaster
              </h3>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: 'rgba(255,255,255,0.5)',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                Create a new Farcaster account, set up your profile, and
                discover what Farcaster is all about.
              </p>
            </div>
            {choosing === 'new' && (
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                  flexShrink: 0,
                  marginTop: '0.75rem',
                }}
              />
            )}
          </button>

          {/* "I have Farcaster" card */}
          <button
            type="button"
            onClick={() => handleChoice('existing_connected')}
            disabled={choosing !== null}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
              padding: '1.5rem',
              background: 'var(--surface, #1C1C1C)',
              border: '1px solid var(--border, rgba(255,255,255,0.08))',
              borderRadius: 14,
              cursor: choosing !== null ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.15s, background 0.15s',
              opacity: choosing === 'new' ? 0.5 : 1,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(124, 101, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                flexShrink: 0,
              }}
            >
              🔵
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', margin: '0 0 0.25rem' }}>
                I already have Farcaster
              </h3>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: 'rgba(255,255,255,0.5)',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                Connect your existing Farcaster account and bring your
                follows, casts, and identity with you.
              </p>
            </div>
            {choosing === 'existing' && (
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                  flexShrink: 0,
                  marginTop: '0.75rem',
                }}
              />
            )}
          </button>
        </div>

        {error && (
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'rgba(239, 68, 68, 0.85)',
              textAlign: 'center',
              marginTop: '1rem',
            }}
          >
            {error}
          </p>
        )}

        <p
          style={{
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.25)',
            textAlign: 'center',
            marginTop: '1.5rem',
          }}
        >
          You can always change this later in Settings.
        </p>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}