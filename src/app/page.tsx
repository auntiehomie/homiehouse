import type { Metadata } from 'next';
import { Suspense } from 'react';
import HomeClient from '@/app/_page-clients/HomeClient';
import SentryErrorBoundary from '@/components/SentryErrorBoundary';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

export const metadata: Metadata = {
  title: 'HomieHouse — Learn decentralized social, one conversation at a time',
  description:
    'Explore decentralized social networks through personalized lessons, plain-English AI answers, and community feeds.',
  alternates: { canonical: BASE_URL },
  openGraph: {
    type: 'website',
    title: 'HomieHouse — Learn decentralized social, one conversation at a time',
    description:
      'Explore decentralized social networks through personalized lessons, plain-English AI answers, and community feeds.',
    url: BASE_URL,
    siteName: 'HomieHouse',
    images: [{ url: `${BASE_URL}/api/og`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HomieHouse — Learn decentralized social, one conversation at a time',
    description:
      'Understand how decentralized social works, learn at your pace, and join the conversation.',
    images: [`${BASE_URL}/api/og`],
  },
};

export default function HomePage() {
  return (
    <SentryErrorBoundary label="Home">
      <Suspense>
        <HomeClient />
      </Suspense>
    </SentryErrorBoundary>
  );
}
