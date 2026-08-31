import type { Metadata } from 'next';
import { Suspense } from 'react';
import HomeClient from '@/app/_page-clients/HomeClient';
import SentryErrorBoundary from '@/components/SentryErrorBoundary';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

export const metadata: Metadata = {
  title: 'HomieHouse — Your cozy, decentralized learning corner',
  description:
    'AI-built learning plans, your Farcaster feed, an AI tutor, and a personal knowledge base — all in one place. Free, and built on the open social web.',
  alternates: { canonical: BASE_URL },
  openGraph: {
    type: 'website',
    title: 'HomieHouse — Your cozy, decentralized learning corner',
    description:
      'AI-built learning plans, your Farcaster feed, an AI tutor, and a personal knowledge base. Built on Farcaster.',
    url: BASE_URL,
    siteName: 'HomieHouse',
    images: [{ url: `${BASE_URL}/api/og/cast?hash=home`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HomieHouse — Your cozy, decentralized learning corner',
    description:
      'Learn Web3 your way with AI-built learning plans and your Farcaster feed.',
    images: [`${BASE_URL}/api/og/cast?hash=home`],
  },
};

export default function HomePage() {
  return (
    <SentryErrorBoundary label="Home">
      <Suspense>
        <HomeClient />
      </Suspense>
    </SentryErrorBoundary>
  );
}