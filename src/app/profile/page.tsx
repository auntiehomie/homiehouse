'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import AppShell from '@/components/AppShell';
import { useFarcasterWrites } from '@/hooks/useFarcasterWrites';

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
  parent_hash?: string;
  parent_author?: { fid: number; username: string };
  replies: { count: number };
  reactions: { likes_count: number; recasts_count: number };
  embeds?: any[];
}

interface Trade {
  hash: string;
  type: 'buy' | 'sell' | 'transfer';
  tokenSymbol: string;
  tokenName: string;
  amount: string;
  from: string;
  to: string;
  timestamp: number;
  contractAddress: string;
}

type Tab = 'casts' | 'replies' | 'trades' | 'learning';

function LearningTab({ profileFid }: { profileFid: number }) {
  const [plan, setPlan] = useState<any>(null);
  const [progress, setProgress] = useState<Set<string>>(new Set());
  const [viewerFid, setViewerFid] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('hh_profile');
      if (raw) {
        const p = JSON.parse(raw);
        setViewerFid(p.fid ?? null);
      }
    } catch {}
    try {
      const p = localStorage.getItem('hh_learning_plan');
      if (p) setPlan(JSON.parse(p));
      const prog = localStorage.getItem('hh_learning_progress');
      if (prog) setProgress(new Set(JSON.parse(prog)));
    } catch {}
  }, []);

  const isOwnProfile = viewerFid === profileFid;

  if (!isOwnProfile) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🎓</div>
        <p style={{ fontWeight: 600, marginBottom: 6 }}>Learning on HomieHouse</p>
        <p style={{ color: 'var(--muted-on-dark)', fontSize: 14, marginBottom: 20 }}>
          Start your own Web3 learning journey and share your progress with the community.
        </p>
        <a href="/learn" style={{
          display: 'inline-block', padding: '10px 24px', borderRadius: 10,
          background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 14,
          textDecoration: 'none',
        }}>
          Start Learning →
        </a>
      </div>
    );
  }

  if (!plan) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
        <p style={{ fontWeight: 600, marginBottom: 6 }}>No learning plan yet</p>
        <p style={{ color: 'var(--muted-on-dark)', fontSize: 14, marginBottom: 20 }}>
          Build a personalized Web3 learning path tailored to your goals.
        </p>
        <a href="/learn" style={{
          display: 'inline-block', padding: '10px 24px', borderRadius: 10,
          background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 14,
          textDecoration: 'none',
        }}>
          Build My Plan →
        </a>
      </div>
    );
  }

  const modules: any[] = plan.modules || [];
  const completed = progress.size;
  const total = modules.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      {/* Plan header */}
      <div className="surface" style={{ borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>My Learning Plan</span>
          <span style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>{completed}/{total} modules · {pct}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width 0.4s' }} />
        </div>
        {plan.summary && (
          <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', marginTop: 10, lineHeight: 1.5 }}>{plan.summary}</p>
        )}
      </div>

      {/* Module list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {modules.map((mod: any, i: number) => {
          const done = progress.has(mod.id);
          return (
            <div key={mod.id} className="surface" style={{ borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: done ? 0.6 : 1 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                background: done ? 'var(--accent)' : 'transparent',
                border: `2px solid ${done ? 'var(--accent)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {done && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="var(--bg-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0, textDecoration: done ? 'line-through' : 'none' }}>{String(i + 1).padStart(2, '0')} {mod.title}</p>
                <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', margin: '2px 0 0' }}>{mod.estimatedMinutes} min · {mod.difficulty}</p>
              </div>
            </div>
          );
        })}
      </div>

      {pct === 100 && (
        <div style={{ textAlign: 'center', marginTop: 20, padding: '1rem', background: 'rgba(52,211,153,0.1)', borderRadius: 12, border: '1px solid rgba(52,211,153,0.2)' }}>
          <p style={{ fontSize: 20, margin: '0 0 6px' }}>🎉</p>
          <p style={{ fontWeight: 700, color: '#34d399', margin: 0 }}>Plan complete!</p>
        </div>
      )}
    </div>
  );
}

function CastCard({ cast }: { cast: Cast }) {
  let timeLabel = '';
  try {
    if (cast?.timestamp) {
      const d = new Date(cast.timestamp);
      if (!isNaN(d.getTime())) timeLabel = formatDistanceToNow(d, { addSuffix: true });
    }
  } catch {}

  return (
    <Link
      href={`/cast/${cast.hash}`}
      className="surface"
      style={{ display: 'block', padding: '1rem', borderRadius: 10, textDecoration: 'none', color: 'inherit', transition: 'border-color 0.2s' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '')}
    >
      {cast.parent_author && (
        <p style={{ fontSize: '0.75rem', color: 'var(--muted-on-dark)', marginBottom: '0.5rem' }}>
          ↩ replying to @{cast.parent_author.username}
        </p>
      )}
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
}

function TradeCard({ trade }: { trade: Trade }) {
  const time = formatDistanceToNow(new Date(trade.timestamp), { addSuffix: true });
  const typeColor = trade.type === 'buy' ? '#22c55e' : trade.type === 'sell' ? '#f87171' : 'var(--muted-on-dark)';
  const typeLabel = trade.type === 'buy' ? '↙ Buy' : trade.type === 'sell' ? '↗ Sell' : '⇄ Transfer';
  const shortHash = `${trade.hash.slice(0, 6)}…${trade.hash.slice(-4)}`;

  return (
    <a
      href={`https://basescan.org/tx/${trade.hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="surface"
      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', borderRadius: 10, textDecoration: 'none', color: 'inherit', transition: 'border-color 0.2s' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '')}
    >
      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '1.1rem' }}>
          {trade.type === 'buy' ? '📈' : trade.type === 'sell' ? '📉' : '↔️'}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: typeColor }}>{typeLabel}</span>
          <span style={{ fontWeight: 700 }}>{trade.amount}</span>
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{trade.tokenSymbol}</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted-on-dark)', marginTop: 2 }}>
          {trade.tokenName} · {shortHash} · {time}
        </div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--muted-on-dark)', flexShrink: 0 }}>
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

function ProfileContent() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [castsLoading, setCastsLoading] = useState(true);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('casts');
  const [viewerFid, setViewerFid] = useState<number | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { follow, unfollow } = useFarcasterWrites();

  useEffect(() => {
    try {
      const raw = localStorage.getItem('hh_profile');
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.fid) setViewerFid(p.fid);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const username = searchParams.get('user');

        let url: string;
        if (username) {
          url = `/api/profile?username=${username}&casts=true`;
        } else {
          const storedProfile = localStorage.getItem('hh_profile');
          if (!storedProfile) { router.push('/'); return; }
          const { fid } = JSON.parse(storedProfile);
          url = `/api/profile?fid=${fid}&casts=true`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch profile');

        const data = await response.json();
        const payload = data?.data ?? data;
        const user = payload.user ?? payload;
        const castsResp = payload.casts ?? (payload.user?.casts ?? null);

        const normalizedUser = {
          ...user,
          follower_count: typeof user?.follower_count === 'number' ? user.follower_count : Number(user?.follower_count) || 0,
          following_count: typeof user?.following_count === 'number' ? user.following_count : Number(user?.following_count) || 0,
        };

        setProfile(normalizedUser as UserProfile);
        if (castsResp) setCasts(castsResp);
        setCastsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
        setCastsLoading(false);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router, searchParams]);

  // Check follow status once profile and viewerFid are both known
  useEffect(() => {
    if (!profile || !viewerFid || viewerFid === profile.fid) return;
    fetch(`/api/follow-status?fid=${viewerFid}&target_fid=${profile.fid}`)
      .then((r) => r.json())
      .then((d) => setIsFollowing(!!d.following))
      .catch(() => {});
  }, [profile, viewerFid]);

  // Fetch trades when trades tab selected and we have ETH addresses
  useEffect(() => {
    if (activeTab !== 'trades' || !profile) return;
    const ethAddresses = profile.verified_addresses?.eth_addresses ?? [];
    if (ethAddresses.length === 0 || trades.length > 0) return;

    setTradesLoading(true);
    fetch(`/api/trades?addresses=${ethAddresses.join(',')}`)
      .then((r) => r.json())
      .then((data) => setTrades(data.trades ?? []))
      .catch(() => setTrades([]))
      .finally(() => setTradesLoading(false));
  }, [activeTab, profile, trades.length]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
        <span style={{ color: 'var(--muted-on-dark)' }}>Loading profile...</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ color: '#f87171' }}>{error || 'Profile not found'}</p>
        <Link href="/" style={{ color: 'var(--accent)' }}>Go back home</Link>
      </div>
    );
  }

  const topLevelCasts = casts.filter((c) => !c.parent_hash);
  const replies = casts.filter((c) => !!c.parent_hash);
  const ethAddresses = profile.verified_addresses?.eth_addresses ?? [];

  const TAB_ITEMS: { id: Tab; label: string }[] = [
    { id: 'casts', label: 'Recent Casts' },
    { id: 'replies', label: 'Replies' },
    { id: 'trades', label: 'Recent Trades' },
    { id: 'learning', label: '🎓 Learning' },
  ];

  return (
    <>
      {/* Back link */}
      <Link
        href="/feed"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--muted-on-dark)', marginBottom: '1rem', textDecoration: 'none', fontSize: '0.9rem' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Back to feed
      </Link>

      {/* Profile card */}
      <div className="surface" style={{ borderRadius: 12, overflow: 'hidden', marginBottom: '1.5rem' }}>
        {/* Header gradient */}
        <div style={{ height: '7rem', background: 'linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)' }} />

        <div style={{ padding: '0 1.5rem 1.5rem' }}>
          {/* Avatar */}
          <div style={{ position: 'relative', marginTop: '-4rem', marginBottom: '1rem' }}>
            <img
              src={profile.pfp_url || '/default-avatar.png'}
              alt={profile.display_name || 'User avatar'}
              style={{ width: '8rem', height: '8rem', borderRadius: '50%', border: '4px solid var(--surface)', objectFit: 'cover' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
            />
            {profile.power_badge && (
              <div style={{ position: 'absolute', bottom: 0, right: 0, background: '#3b82f6', borderRadius: '50%', width: '2.25rem', height: '2.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid var(--surface)' }}>
                <span style={{ color: '#fff', fontSize: '1rem', lineHeight: 1 }}>✓</span>
              </div>
            )}
          </div>

          {/* Name + Follow button row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>{profile.display_name}</h1>
              <p style={{ color: 'var(--muted-on-dark)', margin: 0 }}>@{profile.username}</p>
            </div>
            {viewerFid && viewerFid !== profile.fid && (
              <button
                onClick={async () => {
                  setFollowLoading(true);
                  try {
                    if (isFollowing) {
                      await unfollow(profile.fid);
                      setIsFollowing(false);
                    } else {
                      await follow(profile.fid);
                      setIsFollowing(true);
                    }
                  } catch (err: any) {
                    alert(err?.message || 'Failed — make sure your signer is approved in Warpcast.');
                  } finally {
                    setFollowLoading(false);
                  }
                }}
                disabled={followLoading}
                style={{
                  flexShrink: 0,
                  marginTop: '0.35rem',
                  padding: '8px 18px',
                  borderRadius: 20,
                  border: isFollowing ? '1.5px solid var(--border)' : 'none',
                  background: isFollowing ? 'transparent' : 'var(--accent)',
                  color: isFollowing ? 'var(--text-on-dark)' : '#fff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: followLoading ? 'not-allowed' : 'pointer',
                  opacity: followLoading ? 0.6 : 1,
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {followLoading ? '…' : isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{profile.follower_count.toLocaleString()}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted-on-dark)' }}>Followers</div>
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{profile.following_count.toLocaleString()}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted-on-dark)' }}>Following</div>
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{profile.fid}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted-on-dark)' }}>FID</div>
            </div>
          </div>

          {/* Bio */}
          {profile.profile?.bio?.text && (
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: ethAddresses.length > 0 ? '1rem' : 0 }}>
              {profile.profile.bio.text}
            </p>
          )}

          {/* Verified ETH addresses */}
          {ethAddresses.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {ethAddresses.map((addr) => (
                <a
                  key={addr}
                  href={`https://basescan.org/address/${addr}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                    borderRadius: 20, fontSize: '0.75rem', fontFamily: 'monospace',
                    background: 'var(--bg-dark)', border: '1px solid var(--border)',
                    color: 'var(--muted-on-dark)', textDecoration: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = '')}
                >
                  <span style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>⛓</span>
                  {addr.slice(0, 6)}…{addr.slice(-4)}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.9rem', fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? 'var(--text-on-dark)' : 'var(--muted-on-dark)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'casts' && (
        castsLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-on-dark)' }}>Loading casts...</div>
        ) : topLevelCasts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-on-dark)' }}>No casts yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {topLevelCasts.map((cast) => <CastCard key={cast.hash} cast={cast} />)}
          </div>
        )
      )}

      {activeTab === 'replies' && (
        castsLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-on-dark)' }}>Loading replies...</div>
        ) : replies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-on-dark)' }}>No replies in recent casts</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {replies.map((cast) => <CastCard key={cast.hash} cast={cast} />)}
          </div>
        )
      )}

      {activeTab === 'trades' && (
        ethAddresses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-on-dark)' }}>
            No verified ETH addresses linked to this Farcaster account.
          </div>
        ) : tradesLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-on-dark)' }}>Loading trades...</div>
        ) : trades.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-on-dark)' }}>No recent token activity found on Base.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {trades.map((trade) => <TradeCard key={trade.hash + trade.contractAddress} trade={trade} />)}
          </div>
        )
      )}

      {activeTab === 'learning' && (
        <LearningTab profileFid={profile.fid} />
      )}
    </>
  );
}

export default function ProfilePage() {
  return (
    <AppShell>
      <Suspense fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
          <span style={{ color: 'var(--muted-on-dark)' }}>Loading profile...</span>
        </div>
      }>
        <ProfileContent />
      </Suspense>
    </AppShell>
  );
}
