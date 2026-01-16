'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface UserProfile {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  profile: {
    bio: {
      text: string;
    };
  };
  follower_count: number;
  following_count: number;
  verified_addresses: {
    eth_addresses: string[];
  };
  power_badge: boolean;
}

function ProfileContent() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const username = searchParams.get('user');
        
        if (username) {
          // Fetch profile by username
          const response = await fetch(`/api/profile?username=${username}`);
          if (!response.ok) {
            throw new Error('Failed to fetch profile');
          }
          const data = await response.json();
          setProfile(data);
        } else {
          // Get current user from localStorage
          const storedProfile = localStorage.getItem('hh_profile');
          if (!storedProfile) {
            router.push('/');
            return;
          }

          const { fid } = JSON.parse(storedProfile);

          // Fetch full profile from API
          const response = await fetch(`/api/profile?fid=${fid}`);
          if (!response.ok) {
            throw new Error('Failed to fetch profile');
          }

          const data = await response.json();
          setProfile(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Profile not found'}</p>
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6"
        >
          ← Back to feed
        </Link>

        {/* Profile card */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden">
          {/* Header with gradient */}
          <div className="h-32 bg-gradient-to-r from-purple-500 to-blue-500"></div>

          {/* Profile info */}
          <div className="px-6 pb-6">
            {/* Avatar */}
            <div className="relative -mt-16 mb-4">
              <img
                src={profile.pfp_url}
                alt={profile.display_name}
                className="w-32 h-32 rounded-full border-4 border-white dark:border-zinc-900 shadow-lg"
              />
              {profile.power_badge && (
                <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full w-10 h-10 flex items-center justify-center border-4 border-white dark:border-zinc-900">
                  <span className="text-white text-xl">🔵</span>
                </div>
              )}
            </div>

            {/* Name and username */}
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {profile.display_name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">@{profile.username}</p>

            {/* Stats */}
            <div className="flex gap-6 mb-6 pb-6 border-b border-gray-200 dark:border-zinc-800">
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {profile.follower_count.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Followers</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {profile.following_count.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Following</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{profile.fid}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">FID</div>
              </div>
            </div>

            {/* Bio */}
            {profile.profile?.bio?.text && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Bio</h2>
                <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {profile.profile.bio.text}
                </p>
              </div>
            )}

            {/* Verified addresses */}
            {profile.verified_addresses?.eth_addresses?.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  💎 Verified Ethereum Addresses
                </h2>
                <div className="space-y-2">
                  {profile.verified_addresses.eth_addresses.map((address, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-50 dark:bg-zinc-800 rounded px-3 py-2 font-mono text-sm text-gray-700 dark:text-gray-300 break-all"
                    >
                      {address}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View on Warpcast */}
            <a
              href={`https://warpcast.com/${profile.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              View on Warpcast →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading profile...</div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
