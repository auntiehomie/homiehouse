import type { Metadata } from 'next';
import { Suspense } from 'react';
import SearchClient from '@/app/_page-clients/SearchClient';

export const metadata: Metadata = {
  title: 'Search | HomieHouse',
  description: 'Search Farcaster casts, users, and channels on HomieHouse.',
  openGraph: {
    title: 'Search | HomieHouse',
    description: 'Search Farcaster casts, users, and channels on HomieHouse.',
  },
};

export default function SearchPage() {
  return (
    <Suspense>
      <SearchClient />
    </Suspense>
  );
}