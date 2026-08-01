import type { Metadata } from 'next';
import { Suspense } from 'react';
import Hh2Client from '@/app/_page-clients/Hh2Client';

export const metadata: Metadata = {
  title: 'HH2 Points | HomieHouse',
  description: 'Earn HH2 points by completing learning modules and claim them to your Base wallet on HomieHouse.',
  openGraph: {
    title: 'HH2 Points | HomieHouse',
    description: 'Earn and claim HH2 points by learning Web3 on HomieHouse.',
  },
};

export default function Hh2Page() {
  return (
    <Suspense>
      <Hh2Client />
    </Suspense>
  );
}