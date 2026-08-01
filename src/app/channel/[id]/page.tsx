import type { Metadata } from 'next';
import { Suspense } from 'react';
import ChannelClient from '@/app/_page-clients/ChannelClient';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Channel: ${id} | HomieHouse`,
    description: `Browse casts in the ${id} channel on HomieHouse — powered by Farcaster.`,
    alternates: { canonical: `${BASE_URL}/channel/${encodeURIComponent(id)}` },
    openGraph: {
      title: `Channel: ${id} | HomieHouse`,
      description: `Browse casts in the ${id} channel on HomieHouse.`,
      url: `${BASE_URL}/channel/${encodeURIComponent(id)}`,
    },
  };
}

export default function ChannelPage() {
  return (
    <Suspense>
      <ChannelClient />
    </Suspense>
  );
}