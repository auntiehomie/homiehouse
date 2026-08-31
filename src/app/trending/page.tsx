import type { Metadata } from 'next';
import { Suspense } from 'react';
import TrendingClient from '@/app/_page-clients/TrendingClient';
import SentryErrorBoundary from '@/components/SentryErrorBoundary';

export const metadata: Metadata = {
  title: 'Trending | HomieHouse',
  description: 'See what\'s trending across the Farcaster community on HomieHouse.',
  openGraph: {
    title: 'Trending | HomieHouse',
    description: 'See what\'s trending across the Farcaster community.',
  },
};

export default function TrendingPage() {
  return (
    <SentryErrorBoundary label="Trending">
      <Suspense>
        <TrendingClient />
      </Suspense>
    </SentryErrorBoundary>
  );
}
