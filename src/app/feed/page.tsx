import type { Metadata } from 'next';
import { Suspense } from 'react';
import FeedClient from '@/app/_page-clients/FeedClient';

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
    <Suspense>
      <FeedClient />
    </Suspense>
  );
}