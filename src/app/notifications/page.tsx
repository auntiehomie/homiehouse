'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import SidebarNav from '@/components/SidebarNav';

interface Actor {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  follower_count?: number;
  following_count?: number;
  power_badge?: boolean;
}

interface Notification {
  type: string;
  cast?: {
    hash: string;
    text: string;
    author: Actor;
    embeds?: any[];
  };
  user?: Actor;
  actor?: Actor;
  actors?: Actor[];
  actorCount?: number;
  timestamp: string;
  most_recent_timestamp?: string;
}

type NotificationFilter = 'all' | 'likes' | 'recasts' | 'replies' | 'follows' | 'mentions';

const FILTER_TYPES: Record<string, string[]> = {
  likes:    ['likes', 'like'],
  recasts:  ['recasts', 'recast'],
  replies:  ['reply', 'replies'],
  follows:  ['follows', 'follow'],
  mentions: ['mention', 'mentions'],
};

const FILTER_LABELS: NotificationFilter[] = ['all', 'likes', 'recasts', 'replies', 'follows', 'mentions'];

function getActor(notification: Notification): Actor | null {
  return notification.actor || notification.user || notification.cast?.author || null;
}

function getIcon(type: string) {
  switch (type) {
    case 'likes': case 'like': return '❤️';
    case 'recasts': case 'recast': return '🔄';
    case 'follows': case 'follow': return '👤';
    case 'mention': case 'mentions': return '💬';
    case 'reply': case 'replies': return '↩️';
    default: return '🔔';
  }
}

function getText(type: string) {
  switch (type) {
    case 'likes': case 'like': return 'liked your cast';
    case 'recasts': case 'recast': return 'recasted your cast';
    case 'follows': case 'follow': return 'followed you';
    case 'mention': case 'mentions': return 'mentioned you';
    case 'reply': case 'replies': return 'replied to your cast';
    default: return 'interacted with you';
  }
}

function fmtTime(ts: string) {
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); }
  catch { return 'recently'; }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const router = useRouter();

  const loadNotifications = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const storedProfile = localStorage.getItem('hh_profile');
      if (!storedProfile) { router.push('/'); return; }
      const profile = JSON.parse(storedProfile);
      const fid = profile?.fid;
      if (!fid) { setError('User FID not found'); setLoading(false); return; }

      const response = await fetch(`/api/notifications?fid=${fid}`);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const data = await response.json();
      setNotifications(data.notifications || []);
      setHasMore(data.has_more || false);
      setCursor(data.next_cursor || null);
      if (!silent) setError(null);
    } catch (err) {
      if (!silent) setError('Failed to load notifications');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(() => loadNotifications(true), 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'all') return true;
    return FILTER_TYPES[filter]?.includes(notif.type) ?? false;
  });

  const countFor = (f: NotificationFilter) =>
    f === 'all' ? notifications.length : notifications.filter(n => FILTER_TYPES[f]?.includes(n.type)).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', color: 'var(--text-on-dark)' }}>

      {/* Sticky header */}
      <header style={{ background: 'var(--bg-dark)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Notifications</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => loadNotifications()}
                style={{ color: 'var(--muted-on-dark)', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer' }}
                title="Refresh notifications"
              >
                🔄 Refresh
              </button>
              <Link href="/feed" style={{ color: 'var(--muted-on-dark)', fontSize: 14, textDecoration: 'none' }}>
                ← Back
              </Link>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {FILTER_LABELS.map((f) => {
              const count = countFor(f);
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={
                    active
                      ? { background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-color)', padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', flexShrink: 0 }
                      : { background: 'var(--surface)', color: count > 0 ? 'var(--text-on-dark)' : 'var(--muted-on-dark)', padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', border: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0, opacity: count === 0 && f !== 'all' ? 0.5 : 1 }
                  }
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f !== 'all' && count > 0 && (
                    <span style={{ marginLeft: 5, fontSize: 11, opacity: 0.75 }}>({count})</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 pb-24">
        <div className="flex gap-6 items-start">

          <aside
            className="hidden lg:block shrink-0"
            style={{ width: 220, position: 'sticky', top: 105, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', scrollbarWidth: 'none' }}
          >
            <SidebarNav />
          </aside>

          <main className="flex-1 min-w-0">

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--muted-on-dark)' }}>
                Loading notifications...
              </div>
            ) : error ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '1rem' }}>
                <div style={{ color: 'var(--muted-on-dark)' }}>{error}</div>
                <button onClick={() => loadNotifications()} className="btn primary">Retry</button>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.75rem' }}>
                <div style={{ fontSize: '3rem' }}>🔔</div>
                <div style={{ color: 'var(--muted-on-dark)', textAlign: 'center' }}>
                  {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
                </div>
                {filter !== 'all' && (
                  <button
                    onClick={() => setFilter('all')}
                    style={{ color: 'var(--muted-on-dark)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
                  >
                    View all notifications
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredNotifications.map((notification, index) => {
                  const actor = getActor(notification);
                  const icon = getIcon(notification.type);
                  const text = getText(notification.type);

                  return (
                    <div
                      key={`${notification.timestamp}-${index}`}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                        padding: '1rem', borderRadius: 10,
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
                    >
                      {/* Avatar + badge */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <img
                          src={actor?.pfp_url || '/default-avatar.png'}
                          alt={actor?.display_name || 'User'}
                          style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                          onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
                        />
                        <div style={{
                          position: 'absolute', bottom: -4, right: -4,
                          width: 22, height: 22, borderRadius: '50%',
                          background: 'var(--bg-dark)', border: '2px solid var(--bg-dark)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12,
                        }}>
                          {icon}
                        </div>
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem', marginBottom: 4 }}>
                          <Link
                            href={`/profile?user=${actor?.username || actor?.fid}`}
                            style={{ fontWeight: 600, color: 'var(--text-on-dark)', textDecoration: 'none' }}
                          >
                            {actor?.display_name || actor?.username || 'Someone'}
                          </Link>
                          {notification.actorCount && notification.actorCount > 1 && (
                            <span style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>
                              and {notification.actorCount - 1} other{notification.actorCount - 1 > 1 ? 's' : ''}
                            </span>
                          )}
                          <span style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>{text}</span>
                        </div>

                        {notification.cast?.text && (
                          <Link
                            href={`/cast/${notification.cast.hash}`}
                            style={{
                              display: 'block', marginTop: 8, padding: '8px 10px',
                              background: 'var(--bg-dark)', borderRadius: 8,
                              border: '1px solid var(--border)',
                              fontSize: 13, color: 'var(--muted-on-dark)',
                              textDecoration: 'none', lineHeight: 1.4,
                            } as React.CSSProperties}
                          >
                            {notification.cast.text.length > 320
                              ? notification.cast.text.slice(0, 320) + '…'
                              : notification.cast.text}
                          </Link>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                          <span style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>
                            {fmtTime(notification.timestamp || notification.most_recent_timestamp || '')}
                          </span>
                          {actor?.username && (
                            <Link
                              href={`/profile?user=${actor.username}`}
                              style={{ fontSize: 12, color: 'var(--muted-on-dark)', textDecoration: 'none' }}
                            >
                              View Profile
                            </Link>
                          )}
                          {notification.cast?.hash && (
                            <Link
                              href={`/cast/${notification.cast.hash}`}
                              style={{ fontSize: 12, color: 'var(--muted-on-dark)', textDecoration: 'none' }}
                            >
                              View Cast
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {hasMore && cursor && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                    <button onClick={() => console.log('Load more:', cursor)} className="btn primary">
                      Load More
                    </button>
                  </div>
                )}
              </div>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}
