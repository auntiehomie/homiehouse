'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

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

interface Cast {
  hash: string;
  text: string;
  timestamp: string;
  replies: { count: number };
  reactions: { likes_count: number; recasts_count: number };
  embeds?: any[];
}

function ProfileContent() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(true);
  const [castsLoading, setCastsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const username = searchParams.get('user');
        
        if (username) {
          // Fetch profile by username with casts
          const response = await fetch(`/api/profile?username=${username}&casts=true`);
          if (!response.ok) {
            throw new Error('Failed to fetch profile');
          }
          const data = await response.json();
          setProfile(data);
          
          // Set casts if included
          if (data.casts) {
            setCasts(data.casts);
            setCastsLoading(false);
          }
        } else {
          // Get current user from localStorage
          const storedProfile = localStorage.getItem('hh_profile');
          if (!storedProfile) {
            router.push('/');
            return;
          }

          const { fid } = JSON.parse(storedProfile);

          // Fetch full profile from API with casts
          const response = await fetch(`/api/profile?fid=${fid}&casts=true`);
          if (!response.ok) {
            throw new Error('Failed to fetch profile');
          }

          const data = await response.json();
          setProfile(data);
          
          // Set casts if included
          if (data.casts) {
            setCasts(data.casts);
            setCastsLoading(false);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
        setCastsLoading(false);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Profile not found'}</p>
          <Link href="/" className="text-orange-600 dark:text-orange-400 hover:underline">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black pb-20">
      <div className="px-2">
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 py-4"
        >
          ← Back to feed
        </Link>

        {/* Profile card */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden mb-6">
          {/* Header with gradient */}
          <div className="h-32 bg-gradient-to-r from-purple-500 to-blue-500"></div>

          {/* Profile info */}
          <div className="px-6 pb-6">
            {/* Avatar */}
            <div className="relative -mt-16 mb-4">
              <img
                src={profile.pfp_url}
                alt={profile.display_name}
                className="w-32 h-32 rounded-full border-4 border-white dark:border-zinc-900"
              />
              {profile.power_badge && (
                <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full w-10 h-10 flex items-center justify-center border-4 border-white dark:border-zinc-900">
                  <span className="text-white text-xl">✓</span>
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
              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Bio</h2>
                <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {profile.profile.bio.text}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* User's Casts */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 px-2">Recent Casts</h2>
          
          {castsLoading ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              Loading casts...
            </div>
          ) : casts.length === 0 ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              No casts yet
            </div>
          ) : (
            <div className="space-y-4">
              {casts.map((cast) => {
                const timeLabel = formatDistanceToNow(new Date(cast.timestamp), { addSuffix: true });
                
                return (
                  <Link
                    key={cast.hash}
                    href={`/cast/${cast.hash}`}
                    className="block bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-4 hover:border-orange-500 dark:hover:border-orange-600 transition-colors"
                  >
                    <p className="text-gray-900 dark:text-white mb-3 whitespace-pre-wrap break-words">
                      {cast.text}
                    </p>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>{timeLabel}</span>
                      <span>💬 {cast.replies?.count || 0}</span>
                      <span>❤️ {cast.reactions?.likes_count || 0}</span>
                      <span>🔄 {cast.reactions?.recasts_count || 0}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading profile...</div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
