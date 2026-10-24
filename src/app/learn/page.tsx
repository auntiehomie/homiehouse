import type { Metadata } from 'next';
import { Suspense } from 'react';
import LearnClient from '@/app/_page-clients/LearnClient';
import SentryErrorBoundary from '@/components/SentryErrorBoundary';
import { SAFETY_MODULES } from '@/lib/safety-curriculum';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

// JSON-LD structured data for learning hub
const learnJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'EducationalOrganization',
  name: 'HomieHouse Learning Hub',
  url: `${BASE_URL}/learn`,
  description: 'Turn casts and questions into plain-English answers, short lessons, and personalized paths through AI, privacy, crypto, and decentralized social.',
};

const learnCollectionJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Learning Hub | HomieHouse',
  url: `${BASE_URL}/learn`,
  hasPart: SAFETY_MODULES.map((module) => ({
    '@type': 'LearningResource',
    headline: module.title,
    url: `${BASE_URL}/learn/library/${module.id}`,
  })),
};

export const metadata: Metadata = {
  title: 'Learn | HomieHouse',
  description: 'Turn casts and questions into plain-English answers, short lessons, and personalized paths through AI, privacy, crypto, and decentralized social.',
  openGraph: {
    title: 'Learn | HomieHouse',
    description: 'Understand the ideas behind a cast. Get a plain-English answer, a short lesson, and a path to explore further.',
    type: 'website',
    images: [{
      url: `${BASE_URL}/api/og/content?kind=learning%20hub&title=Learn%20from%20casts%20with%20HomieHouse&description=Plain-English%20answers%2C%20short%20lessons%2C%20and%20personalized%20learning%20paths.`,
      width: 1200,
      height: 630,
      alt: 'HomieHouse Learning Hub',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Learn | HomieHouse',
    description: 'Understand the ideas behind a cast. Get a plain-English answer, a short lesson, and a path to explore further.',
    images: [`${BASE_URL}/api/og/content?kind=learning%20hub&title=Learn%20from%20casts%20with%20HomieHouse&description=Plain-English%20answers%2C%20short%20lessons%2C%20and%20personalized%20learning%20paths.`],
  },
};

export default function LearnPage() {
  return (
    <SentryErrorBoundary label="Learn">
      <Suspense>
        <LearnClient />
      </Suspense>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(learnJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(learnCollectionJsonLd) }}
      />
    </SentryErrorBoundary>
  );
}
