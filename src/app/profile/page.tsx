import type { Metadata } from 'next';
import { Suspense } from 'react';
import ProfileClient from './ProfileClient';
import { fetchUserByUsername } from '@/lib/hypersnap';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ user?: string }> }): Promise<Metadata> {
  const { user: username } = await searchParams;
  if (!username) return { title: 'Profile | HomieHouse' };

  try {
    const { user } = await fetchUserByUsername(username);
    if (!user) return { title: `@${username} | HomieHouse` };

    const displayName = user.display_name || user.username || username;
    const bio = user.profile?.bio?.text || '';
    const title = `${displayName} (@${user.username}) | HomieHouse`;
    const description = bio || `View @${user.username}'s Farcaster profile on HomieHouse`;
    const canonical = `${BASE_URL}/profile?user=${encodeURIComponent(user.username)}`;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      name: title,
      url: canonical,
      mainEntity: {
        '@type': 'Person',
        name: displayName,
        alternateName: `@${user.username}`,
        description: bio || undefined,
        image: user.pfp_url || undefined,
        url: canonical,
      },
    };

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        type: 'profile',
        title,
        description,
        url: canonical,
        images: user.pfp_url
          ? [{ url: user.pfp_url, width: 400, height: 400, alt: displayName }]
          : undefined,
        username: user.username,
      },
      twitter: {
        card: 'summary',
        title,
        description,
        images: user.pfp_url ? [user.pfp_url] : undefined,
      },
      other: {
        'script:ld+json': JSON.stringify(jsonLd),
      },
    };
  } catch {
    return { title: `@${username} | HomieHouse` };
  }
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileClient />
    </Suspense>
  );
}
