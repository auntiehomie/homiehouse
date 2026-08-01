import type { Metadata } from 'next';
import { Suspense } from 'react';
import KbClient from '@/app/_page-clients/KbClient';

export const metadata: Metadata = {
  title: 'Knowledge Base | HomieHouse',
  description: 'Your personal knowledge base — saved Farcaster casts, notes, tags, and curated research on HomieHouse.',
  openGraph: {
    title: 'Knowledge Base | HomieHouse',
    description: 'Your personal knowledge base — saved casts, notes, tags, and curated research.',
  },
};

export default function KbPage() {
  return (
    <Suspense>
      <KbClient />
    </Suspense>
  );
}