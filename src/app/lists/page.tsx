import type { Metadata } from 'next';
import { Suspense } from 'react';
import ListsClient from '@/app/_page-clients/ListsClient';

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
    <Suspense>
      <ListsClient />
    </Suspense>
  );
}