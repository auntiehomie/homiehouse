import type { Metadata } from 'next';
import { Suspense } from 'react';
import LearnClient from '@/app/_page-clients/LearnClient';

export const metadata: Metadata = {
  title: 'Learn | HomieHouse',
  description: 'AI-built Web3 learning plans, daily streak tracking, and bite-sized DeFi lessons on HomieHouse.',
  openGraph: {
    title: 'Learn | HomieHouse',
    description: 'AI-built Web3 learning plans with daily streaks and leaderboards.',
  },
};

export default function LearnPage() {
  return (
    <Suspense>
      <LearnClient />
    </Suspense>
  );
}