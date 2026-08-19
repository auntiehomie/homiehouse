/**
 * Magic Link Sent — Confirmation page displayed after a magic link email
 * has been dispatched.
 *
 * Server component — no client JS needed for this static confirmation.
 */

import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Check Your Email — HomieHouse',
};

export default function MagicLinkSentPage() {
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
        {/* Icon */}
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
          ✉️
        </div>

        <h1
          style={{
            fontSize: '1.375rem',
            fontWeight: 600,
            margin: '0 0 0.5rem',
            color: '#fff',
          }}
        >
          Check your email
        </h1>

        <p
          style={{
            fontSize: '0.9375rem',
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.65)',
            margin: '0 0 1.5rem',
          }}
        >
          We&apos;ve sent a sign-in link to your email. Click the link to sign in
          securely — no password needed.
        </p>

        {/* Spam help */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            textAlign: 'left',
          }}
        >
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'rgba(255,255,255,0.5)',
              margin: '0 0 0.5rem',
              fontWeight: 500,
            }}
          >
            Don&apos;t see it?
          </p>
          <ul
            style={{
              fontSize: '0.8125rem',
              color: 'rgba(255,255,255,0.45)',
              lineHeight: 1.7,
              paddingLeft: '1.125rem',
              margin: 0,
            }}
          >
            <li>Check your spam or promotions folder</li>
            <li>Wait a minute — emails can sometimes be delayed</li>
            <li>Make sure you entered the right email address</li>
          </ul>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
              transition: 'opacity 0.15s',
            }}
          >
            ← Try a different email
          </Link>
        </div>

        <p
          style={{
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.3)',
            marginTop: '1.5rem',
          }}
        >
          Links expire after 15 minutes. Need help? Reach out on Farcaster.
        </p>
      </div>
    </main>
  );
}