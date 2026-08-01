import type { Metadata } from 'next';
import { Suspense } from 'react';
import TrendingClient from '@/app/_page-clients/TrendingClient';

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
    <Suspense>
      <TrendingClient />
    </Suspense>
  );
}