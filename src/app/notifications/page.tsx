'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

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
  reactions?: {
    likes_count?: number;
    recasts_count?: number;
    replies_count?: number;
  };
}

type NotificationFilter = 'all' | 'likes' | 'recasts' | 'replies' | 'follows' | 'mentions';

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg-dark)',
  color: 'var(--text-on-dark)',
  paddingBottom: 80,
};

const headerStyle: React.CSSProperties = {
  background: 'var(--bg-dark)',
  borderBottom: '1px solid var(--border)',
  position: 'sticky',
  top: 0,
  zIndex: 10,
};

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '16px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  transition: 'background 0.15s',
};

const castPreviewStyle: React.CSSProperties = {
  marginTop: 8,
  padding: '12px',
  background: 'var(--surface)',
  borderRadius: 8,
  display: 'block',
  transition: 'opacity 0.15s',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadNotifications();

    const interval = setInterval(() => {
      loadNotifications(true);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const storedProfile = localStorage.getItem('hh_profile');
      if (!storedProfile) {
        router.push('/');
        return;
      }

      const profile = JSON.parse(storedProfile);
      const fid = profile?.fid;

      if (!fid) {
        setError('User FID not found');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/notifications?fid=${fid}`);
      if (!response.ok) throw new Error('Failed to fetch notifications');

      const data = await response.json();
      setNotifications(data.notifications || []);
      setHasMore(data.has_more || false);
      setCursor(data.next_cursor || null);
      if (!silent) setError(null);
    } catch (err) {
      console.error('Error loading notifications:', err);
      if (!silent) setError('Failed to load notifications');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const getActor = (notification: Notification): Actor | null => {
    return notification.actor || notification.user || notification.cast?.author || null;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'likes': return '❤️';
      case 'recasts': return '🔄';
      case 'follows': return '👤';
      case 'mention':
      case 'mentions': return '💬';
      case 'reply':
      case 'replies': return '↩️';
      default: return '🔔';
    }
  };

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'likes': return 'liked your cast';
      case 'recasts': return 'recasted your cast';
      case 'follows': return 'followed you';
      case 'mention':
      case 'mentions': return 'mentioned you';
      case 'reply':
      case 'replies': return 'replied to your cast';
      default: return 'interacted with you';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'all') return true;
    return notif.type === filter || notif.type === filter.slice(0, -1);
  });

  const Header = () => (
    <header style={headerStyle}>
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Notifications</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadNotifications()}
              style={{ color: 'var(--muted-on-dark)', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer' }}
              title="Refresh notifications"
            >
              🔄 Refresh
            </button>
            <Link href="/" style={{ color: 'var(--muted-on-dark)', fontSize: 14 }}>
              ← Back
            </Link>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(['all', 'likes', 'recasts', 'replies', 'follows', 'mentions'] as NotificationFilter[]).map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              style={
                filter === filterType
                  ? { background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-color)', padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', border: 'none', cursor: 'pointer' }
                  : { background: 'var(--surface)', color: 'var(--muted-on-dark)', padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', border: '1px solid var(--border)', cursor: 'pointer' }
              }
            >
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </header>
  );

  if (loading) {
    return (
      <div style={pageStyle}>
        <Header />
        <main className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-center py-12">
            <div style={{ color: 'var(--muted-on-dark)' }}>Loading notifications...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <Header />
        <main className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div style={{ color: 'var(--muted-on-dark)' }}>{error}</div>
            <button onClick={() => loadNotifications()} className="btn primary">
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-6">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="text-6xl">🔔</div>
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
          <div className="space-y-3">
            {filteredNotifications.map((notification, index) => {
              const actor = getActor(notification);
              const notifIcon = getNotificationIcon(notification.type);
              const notifText = getNotificationText(notification);

              return (
                <div
                  key={`${notification.timestamp}-${index}`}
                  style={cardStyle}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  {/* Actor Avatar */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={actor?.pfp_url || '/default-avatar.png'}
                      alt={actor?.display_name || 'User'}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/default-avatar.png';
                      }}
                    />
                    <div
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-sm"
                      style={{ background: 'var(--surface)', border: '2px solid var(--bg-dark)' }}
                    >
                      {notifIcon}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Link
                        href={`/profile/${actor?.username || actor?.fid}`}
                        className="font-semibold hover:underline flex items-center gap-1"
                      >
                        {actor?.display_name || actor?.username || 'Someone'}
                        {actor?.power_badge && (
                          <span style={{ color: 'var(--muted-on-dark)' }} title="Power user">⚡</span>
                        )}
                      </Link>
                      {notification.actorCount && notification.actorCount > 1 && (
                        <span style={{ color: 'var(--muted-on-dark)', fontSize: 14 }}>
                          and {notification.actorCount - 1} other{notification.actorCount - 1 > 1 ? 's' : ''}
                        </span>
                      )}
                      <span style={{ color: 'var(--muted-on-dark)', fontSize: 14 }}>
                        {notifText}
                      </span>
                    </div>

                    {(actor?.follower_count !== undefined || actor?.following_count !== undefined) && (
                      <div className="flex gap-3 mb-2" style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>
                        {actor?.follower_count !== undefined && (
                          <span>{actor.follower_count.toLocaleString()} followers</span>
                        )}
                        {actor?.following_count !== undefined && (
                          <span>{actor.following_count.toLocaleString()} following</span>
                        )}
                      </div>
                    )}

                    {notification.cast?.text && (
                      <Link href={`/cast/${notification.cast.hash}`} style={castPreviewStyle}>
                        <p style={{ fontSize: 14, color: 'var(--text-on-dark)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                          {notification.cast.text}
                        </p>
                        {notification.cast.embeds && notification.cast.embeds.length > 0 && (
                          <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginTop: 4 }}>
                            📎 {notification.cast.embeds.length} attachment{notification.cast.embeds.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </Link>
                    )}

                    <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginTop: 8 }}>
                      {formatTimestamp(notification.timestamp || notification.most_recent_timestamp || '')}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex flex-col gap-1">
                    {actor?.username && (
                      <Link
                        href={`/profile/${actor.username}`}
                        style={{ fontSize: 12, color: 'var(--muted-on-dark)', whiteSpace: 'nowrap' }}
                      >
                        View Profile
                      </Link>
                    )}
                    {notification.cast?.hash && (
                      <Link
                        href={`/cast/${notification.cast.hash}`}
                        style={{ fontSize: 12, color: 'var(--muted-on-dark)', whiteSpace: 'nowrap' }}
                      >
                        View Cast
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && cursor && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => {
                console.log('Load more with cursor:', cursor);
              }}
              className="btn primary"
            >
              Load More
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
