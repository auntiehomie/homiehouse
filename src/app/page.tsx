import type { Metadata } from 'next';
import { Suspense } from 'react';
import HomeClient from '@/app/_page-clients/HomeClient';
import SentryErrorBoundary from '@/components/SentryErrorBoundary';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

export const metadata: Metadata = {
  title: 'HomieHouse — Learn, cast, and grow',
  description:
    'Turn casts into personalized lessons, plain-English answers, and ideas you can use.',
  alternates: { canonical: BASE_URL },
  openGraph: {
    type: 'website',
    title: 'HomieHouse — Learn, cast, and grow',
    description:
      'Turn casts into personalized lessons, plain-English answers, and ideas you can use.',
    url: BASE_URL,
    siteName: 'HomieHouse',
    images: [{ url: `${BASE_URL}/api/og`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HomieHouse — Learn, cast, and grow',
    description:
      'Learn what matters, connect it to your feed, and contribute with confidence.',
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
