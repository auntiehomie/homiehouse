import type { Metadata } from 'next';
import { Suspense } from 'react';
import TokensClient from '@/app/_page-clients/TokensClient';

export const metadata: Metadata = {
  title: 'Tokens | HomieHouse',
  description: 'Explore cryptocurrency tokens, prices, and on-chain data on HomieHouse.',
  openGraph: {
    title: 'Tokens | HomieHouse',
    description: 'Explore cryptocurrency tokens, prices, and on-chain data.',
  },
};

export default function TokensPage() {
  return (
    <Suspense>
      <TokensClient />
    </Suspense>
  );
}