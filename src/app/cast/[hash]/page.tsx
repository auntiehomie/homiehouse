import type { Metadata } from 'next';
import { Suspense } from 'react';
import CastDetailClient from './CastDetailClient';
import { fetchCast } from '@/lib/hypersnap';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

export async function generateMetadata({ params }: { params: Promise<{ hash: string }> }): Promise<Metadata> {
  const { hash } = await params;
  try {
    const data = await fetchCast(hash);
    const cast = data?.cast ?? data;
    if (!cast) return { title: 'Cast | HomieHouse' };

    const author = cast.author;
    const authorName = author?.display_name || author?.username || 'Someone';
    const authorUsername = author?.username || '';
    const text = (cast.text || '').slice(0, 200);
    const snippet = text.length < (cast.text || '').length ? `${text}…` : text;
    const title = `${authorName} on HomieHouse`;
    const description = snippet || `View ${authorName}'s cast on HomieHouse`;
    const ogImageUrl = `${BASE_URL}/api/og/cast?hash=${encodeURIComponent(hash)}`;
    const canonical = `${BASE_URL}/cast/${hash}`;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: snippet || title,
      author: {
        '@type': 'Person',
        name: authorName,
        url: authorUsername ? `${BASE_URL}/profile?user=${authorUsername}` : undefined,
      },
      datePublished: cast.timestamp,
      url: canonical,
      publisher: {
        '@type': 'Organization',
        name: 'HomieHouse',
        url: BASE_URL,
      },
    };

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        type: 'article',
        title,
        description,
        url: canonical,
        images: [{ url: ogImageUrl, width: 1200, height: 630, alt: description }],
        publishedTime: cast.timestamp,
        authors: authorUsername ? [`${BASE_URL}/profile?user=${authorUsername}`] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImageUrl],
      },
      other: {
        'script:ld+json': JSON.stringify(jsonLd),
      },
    };
  } catch {
    return { title: 'Cast | HomieHouse' };
  }
}

export default function CastPage() {
  return (
    <Suspense>
      <CastDetailClient />
    </Suspense>
  );
}
