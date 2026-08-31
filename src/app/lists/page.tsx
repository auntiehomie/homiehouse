import type { Metadata } from 'next';
import { Suspense } from 'react';
import ListsClient from '@/app/_page-clients/ListsClient';
import SentryErrorBoundary from '@/components/SentryErrorBoundary';

export const metadata: Metadata = {
  title: 'Lists | HomieHouse',
  description: 'Curated lists of Farcaster casts — create, share, and follow public collections on HomieHouse.',
  openGraph: {
    title: 'Lists | HomieHouse',
    description: 'Curated lists of Farcaster casts — create, share, and follow public collections.',
  },
};

export default function ListsPage() {
  return (
    <SentryErrorBoundary label="Lists">
      <Suspense>
        <ListsClient />
      </Suspense>
    </SentryErrorBoundary>
  );
}
