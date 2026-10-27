'use client';

/**
 * Verify Magic Link — Client page that reads the ?token= parameter from the
 * URL and calls the verify-magic API route. Auto-redirects on success.
 */

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

type VerifyState = 'verifying' | 'redirecting' | 'error';

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<VerifyState>('verifying');
  const [error, setError] = useState<string | null>(null);
  const verifyCalled = useRef(false);

  useEffect(() => {
    // Prevent double-call in Strict Mode
    if (verifyCalled.current) return;
    verifyCalled.current = true;

    const token = searchParams.get('token');

    if (!token) {
      setError('Invalid or missing sign-in link.');
      setState('error');
      return;
    }

    async function verify() {
      try {
        const res = await fetch(`/api/auth/verify-magic?token=${encodeURIComponent(token!)}`, {
          // Server will set a cookie and redirect with 302.
          // For the server-side redirect to work properly, we need to follow it.
          // But the redirect is cross-origin (from API route to page route),
          // so we need to handle the redirect URL ourselves via the response.

          // Using no-cache to avoid stale responses
          cache: 'no-cache',
        });

        if (res.redirected) {
          // Browser followed the redirect — navigate client-side for cleaner UX
          setState('redirecting');
          const redirectTo = res.url || '/feed';
          // Small delay so user sees "Redirecting..." briefly
          setTimeout(() => {
            router.push(redirectTo);
          }, 600);
          return;
        }

        if (res.status === 302 || res.status === 301) {
          // Redirect but we didn't follow it — extract Location header or fallback
          setState('redirecting');
          setTimeout(() => {
            router.push('/feed');
          }, 600);
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Verification failed' }));
          setError(data.error || 'Verification failed. Your link may have expired.');
          setState('error');
          return;
        }

        // If we got a 200, redirect the browser anyway (cookie should be set)
        setState('redirecting');
        setTimeout(() => {
          router.push('/onboarding');
        }, 600);
      } catch (err: any) {
        setError(err?.message || 'Something went wrong. Please try again.');
        setState('error');
      }
    }

    verify();
  }, [searchParams, router]);

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
          maxWidth: 420,
          width: '100%',
          background: 'var(--surface, #1C1C1C)',
          border: '1px solid var(--border, rgba(255,255,255,0.08))',
          borderRadius: 16,
          padding: '2.5rem 2rem',
          textAlign: 'center',
        }}
      >
        {/* Status icon */}
        {state === 'verifying' && (
          <>
            <div
              style={{
                width: 48,
                height: 48,
                margin: '0 auto 1.5rem',
                border: '3px solid rgba(255,255,255,0.1)',
                borderTopColor: 'rgba(255,255,255,0.6)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                margin: '0 0 0.5rem',
                color: '#fff',
              }}
            >
              Verifying your link…
            </h1>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'rgba(255,255,255,0.5)',
                margin: 0,
              }}
            >
              This should only take a moment.
            </p>
          </>
        )}

        {state === 'redirecting' && (
          <>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
                fontSize: '1.5rem',
              }}
            >
              ✅
            </div>
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                margin: '0 0 0.5rem',
                color: '#fff',
              }}
            >
              Signed in!
            </h1>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'rgba(255,255,255,0.5)',
                margin: 0,
              }}
            >
              Redirecting you now…
            </p>
          </>
        )}

        {state === 'error' && (
          <>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
                fontSize: '1.5rem',
              }}
            >
              ⚠️
            </div>
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                margin: '0 0 0.5rem',
                color: '#fff',
              }}
            >
              Link expired or invalid
            </h1>
            <p
              style={{
                fontSize: '0.9375rem',
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.65)',
                margin: '0 0 1.5rem',
              }}
            >
              {error || 'Your sign-in link may have expired or was already used.'}
            </p>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(180deg, #334155 0%, #1e293b 100%)',
                color: '#e2e8f0',
                borderRadius: 10,
                fontWeight: 600,
                fontSize: '0.9375rem',
                textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              ← Request a new link
            </Link>
          </>
        )}
      </div>

      {/* Spin keyframe */}
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            background: 'var(--background, #111)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              border: '3px solid rgba(255,255,255,0.1)',
              borderTopColor: 'rgba(255,255,255,0.6)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}