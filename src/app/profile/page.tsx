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
          // Support wrapped responses like { data: { user, casts } }
          const payload = data?.data ?? data;
          // Handle both shapes: { user, casts } and flattened { ...user, casts }
          const user = payload.user ?? payload;
          const castsResp = payload.casts ?? (payload.user?.casts ?? null);

          console.log('[Profile Page] Full profile response (payload):', payload);
          console.log('[Profile Page] Profile data received (summary):', {
            fid: user?.fid,
            username: user?.username,
            hasCasts: !!castsResp,
            castsCount: castsResp?.length || 0,
            userKeys: user ? Object.keys(user).slice(0, 20) : null
          });

          // Normalize numeric fields to avoid client runtime errors (ensure toLocaleString safe)
          const normalizedUser = {
            ...user,
            follower_count: typeof user?.follower_count === 'number' ? user.follower_count : Number(user?.follower_count) || 0,
            following_count: typeof user?.following_count === 'number' ? user.following_count : Number(user?.following_count) || 0,
          };

          setProfile(normalizedUser as UserProfile);

          // Set casts if included
          if (castsResp) {
            console.log('[Profile Page] Setting casts:', castsResp.length);
            setCasts(castsResp);
            setCastsLoading(false);
          } else {
            console.log('[Profile Page] No casts in response');
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
          console.log('[Profile Page] Fetching profile for FID:', fid);
          const response = await fetch(`/api/profile?fid=${fid}&casts=true`);
          if (!response.ok) {
            throw new Error('Failed to fetch profile');
          }

          const data = await response.json();
          // Support wrapped responses like { data: { user, casts } }
          const payload = data?.data ?? data;
          // Handle both shapes: { user, casts } and flattened { ...user, casts }
          const user = payload.user ?? payload;
          const castsResp = payload.casts ?? (payload.user?.casts ?? null);

          console.log('[Profile Page] Full profile response (payload):', payload);
          console.log('[Profile Page] Profile data received (summary):', {
            fid: user?.fid,
            username: user?.username,
            hasCasts: !!castsResp,
            castsCount: castsResp?.length || 0,
            userKeys: user ? Object.keys(user).slice(0, 20) : null
          });

          // Normalize numeric fields to avoid client runtime errors (ensure toLocaleString safe)
          const normalizedUser = {
            ...user,
            follower_count: typeof user?.follower_count === 'number' ? user.follower_count : Number(user?.follower_count) || 0,
            following_count: typeof user?.following_count === 'number' ? user.following_count : Number(user?.following_count) || 0,
          };

          setProfile(normalizedUser as UserProfile);

          // Set casts if included
          if (castsResp) {
            console.log('[Profile Page] Setting casts:', castsResp.length);
            setCasts(castsResp);
            setCastsLoading(false);
          } else {
            console.log('[Profile Page] No casts in response');
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
      <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--muted-on-dark)' }}>Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#f87171', marginBottom: '1rem' }}>{error || 'Profile not found'}</p>
          <Link href="/" style={{ color: 'var(--accent)' }}>
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', paddingBottom: '5rem' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 0.75rem' }}>
        {/* Back button */}
        <Link
          href="/"
          style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--muted-on-dark)', padding: '1rem 0', textDecoration: 'none' }}
        >
          ← Back to feed
        </Link>

        {/* Profile card */}
        <div className="surface" style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem', padding: 0 }}>
          {/* Header with brand gradient */}
          <div style={{ height: '7rem', background: 'linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)' }} />

          {/* Profile info */}
          <div style={{ padding: '0 1.5rem 1.5rem' }}>
            {/* Avatar */}
            <div style={{ position: 'relative', marginTop: '-4rem', marginBottom: '1rem' }}>
              <img
                src={profile.pfp_url || '/default-avatar.png'}
                alt={profile.display_name || 'User avatar'}
                style={{
                  width: '8rem',
                  height: '8rem',
                  borderRadius: '50%',
                  border: '4px solid var(--surface)',
                  objectFit: 'cover',
                }}
                onError={(e) => {
                  // @ts-ignore
                  e.currentTarget.src = '/default-avatar.png';
                }}
              />
              {profile.power_badge && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  background: '#3b82f6',
                  borderRadius: '50%',
                  width: '2.25rem',
                  height: '2.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '3px solid var(--surface)',
                }}>
                  <span style={{ color: '#fff', fontSize: '1rem', lineHeight: 1 }}>✓</span>
                </div>
              )}
            </div>

            {/* Name and username */}
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              {profile.display_name}
            </h1>
            <p style={{ color: 'var(--muted-on-dark)', marginBottom: '1rem' }}>@{profile.username}</p>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  {typeof profile.follower_count === 'number' ? profile.follower_count.toLocaleString() : '0'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted-on-dark)' }}>Followers</div>
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  {typeof profile.following_count === 'number' ? profile.following_count.toLocaleString() : '0'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted-on-dark)' }}>Following</div>
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{profile.fid}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted-on-dark)' }}>FID</div>
              </div>
            </div>

            {/* Bio */}
            {profile.profile?.bio?.text && (
              <div>
                <h2 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted-on-dark)', marginBottom: '0.5rem' }}>Bio</h2>
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {profile.profile.bio.text}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* User's Casts */}
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', paddingLeft: '0.25rem' }}>Recent Casts</h2>
          
          {castsLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-on-dark)' }}>
              Loading casts...
            </div>
          ) : casts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-on-dark)' }}>
              No casts yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {casts.map((cast) => {
                let timeLabel = '';
                try {
                  if (cast?.timestamp) {
                    const d = new Date(cast.timestamp);
                    if (!isNaN(d.getTime())) {
                      timeLabel = formatDistanceToNow(d, { addSuffix: true });
                    }
                  }
                } catch (e) {
                  console.error('[Profile Page] Error formatting cast timestamp', e);
                }

                return (
                  <Link
                    key={cast.hash}
                    href={`/cast/${cast.hash}`}
                    className="surface"
                    style={{
                      display: 'block',
                      padding: '1rem',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '')}
                  >
                    <p style={{ marginBottom: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                      {cast.text}
                    </p>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--muted-on-dark)' }}>
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
      <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--muted-on-dark)' }}>Loading profile...</div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
