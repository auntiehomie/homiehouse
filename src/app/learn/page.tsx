import type { Metadata } from 'next';
import { Suspense } from 'react';
import LearnClient from '@/app/_page-clients/LearnClient';
import SentryErrorBoundary from '@/components/SentryErrorBoundary';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

// JSON-LD structured data for learning hub
const learnJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'EducationalOrganization',
  name: 'HomieHouse Learning Hub',
  url: `${BASE_URL}/learn`,
  description: 'AI-built Web3 learning plans with daily streaks, bite-sized DeFi lessons, and interactive quizzes.',
};

const learnCollectionJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Learning Hub | HomieHouse',
  url: `${BASE_URL}/learn`,
  hasPart: [
    { '@type': 'Article', headline: 'DeFi Fundamentals', url: `${BASE_URL}/learn` },
    { '@type': 'Article', headline: 'Web3 Essentials', url: `${BASE_URL}/learn` },
    { '@type': 'Article', headline: 'Farcaster & Decentralized Social', url: `${BASE_URL}/learn` },
  ],
};

export const metadata: Metadata = {
  title: 'Learn | HomieHouse',
  description: 'AI-built Web3 learning plans, daily streak tracking, and bite-sized DeFi lessons on HomieHouse.',
  openGraph: {
    title: 'Learn | HomieHouse',
    description: 'AI-built Web3 learning plans with daily streaks and leaderboards.',
    type: 'website',
    images: [{
      url: `${BASE_URL}/api/og/content?kind=learning%20hub&title=Learn%20Web3%20with%20HomieHouse&description=AI-built%20learning%20plans%2C%20daily%20streaks%2C%20and%20bite-sized%20lessons.`,
      width: 1200,
      height: 630,
      alt: 'HomieHouse Learning Hub',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Learn | HomieHouse',
    description: 'AI-built Web3 learning plans with daily streaks and leaderboards.',
    images: [`${BASE_URL}/api/og/content?kind=learning%20hub&title=Learn%20Web3%20with%20HomieHouse&description=AI-built%20learning%20plans%2C%20daily%20streaks%2C%20and%20bite-sized%20lessons.`],
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