import type { Metadata } from 'next';
import { Suspense } from 'react';
import TokenDetailClient from '@/app/_page-clients/TokenDetailClient';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  return {
    title: `$${symbol.toUpperCase()} | HomieHouse`,
    description: `Token details, price, and on-chain data for $${symbol.toUpperCase()} on HomieHouse.`,
    alternates: { canonical: `${BASE_URL}/tokens/${encodeURIComponent(symbol)}` },
    openGraph: {
      title: `$${symbol.toUpperCase()} | HomieHouse`,
      description: `Token details for $${symbol.toUpperCase()} on HomieHouse.`,
      url: `${BASE_URL}/tokens/${encodeURIComponent(symbol)}`,
    },
  };
}

export default function TokenDetailPage() {
  return (
    <Suspense>
      <TokenDetailClient />
    </Suspense>
  );
}