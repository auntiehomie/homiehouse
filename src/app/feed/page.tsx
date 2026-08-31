import type { Metadata } from 'next';
import { Suspense } from 'react';
import FeedClient from '@/app/_page-clients/FeedClient';
import SentryErrorBoundary from '@/components/SentryErrorBoundary';

export const metadata: Metadata = {
  title: 'Feed | HomieHouse',
  description: 'Your personalized Farcaster feed on HomieHouse — follow builders and browse the decentralized web.',
  openGraph: {
    title: 'Feed | HomieHouse',
    description: 'Your personalized Farcaster feed on HomieHouse.',
  },
};

export default function FeedPage() {
  return (
    <SentryErrorBoundary label="Feed">
      <Suspense>
        <FeedClient />
      </Suspense>
    </SentryErrorBoundary>
  );
}