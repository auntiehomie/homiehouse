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
  timestamp: string;
  most_recent_timestamp?: string;
  reactions?: {
    likes_count?: number;
    recasts_count?: number;
    replies_count?: number;
  };
}

type NotificationFilter = 'all' | 'likes' | 'recasts' | 'replies' | 'follows' | 'mentions';

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
    
    // Poll for new notifications every 30 seconds
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
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

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
      case 'likes':
        return '❤️';
      case 'recasts':
        return '🔄';
      case 'follows':
        return '👤';
      case 'mention':
      case 'mentions':
        return '💬';
      case 'reply':
      case 'replies':
        return '↩️';
      default:
        return '🔔';
    }
  };

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'likes':
        return 'liked your cast';
      case 'recasts':
        return 'recasted your cast';
      case 'follows':
        return 'followed you';
      case 'mention':
      case 'mentions':
        return 'mentioned you';
      case 'reply':
      case 'replies':
        return 'replied to your cast';
      default:
        return 'interacted with you';
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
    return notif.type === filter || notif.type === filter.slice(0, -1); // Handle singular/plural
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-zinc-100">
        <header className="max-w-4xl mx-auto px-6 py-6 border-b dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Notifications</h1>
            <Link href="/" className="text-sm text-blue-500 hover:underline">
              ← Back
            </Link>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-zinc-500">Loading notifications...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-zinc-100">
        <header className="max-w-4xl mx-auto px-6 py-6 border-b dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Notifications</h1>
            <Link href="/" className="text-sm text-blue-500 hover:underline">
              ← Back
            </Link>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="text-red-500">{error}</div>
            <button 
              onClick={() => loadNotifications()}
              className="btn primary"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-zinc-100 pb-20">
      <header className="max-w-4xl mx-auto px-6 py-6 border-b dark:border-zinc-800 sticky top-0 bg-white dark:bg-black z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Notifications</h1>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => loadNotifications()}
              className="text-sm text-blue-500 hover:underline"
              title="Refresh notifications"
            >
              🔄 Refresh
            </button>
            <Link href="/" className="text-sm text-blue-500 hover:underline">
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
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === filterType
                  ? 'bg-blue-500 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="text-6xl">🔔</div>
            <div className="text-zinc-500 text-center">
              {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
            </div>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="text-sm text-blue-500 hover:underline"
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
                  className="flex items-start gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 rounded-lg transition-colors border dark:border-zinc-800"
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
                    {/* Notification Type Badge */}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center text-sm border-2 border-white dark:border-zinc-900">
                      {notifIcon}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Actor Info */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Link 
                        href={`/profile/${actor?.username || actor?.fid}`}
                        className="font-semibold hover:underline flex items-center gap-1"
                      >
                        {actor?.display_name || actor?.username || 'Someone'}
                        {actor?.power_badge && (
                          <span className="text-purple-500" title="Power user">⚡</span>
                        )}
                      </Link>
                      <span className="text-zinc-500 text-sm">
                        {notifText}
                      </span>
                    </div>

                    {/* Actor Stats */}
                    {(actor?.follower_count !== undefined || actor?.following_count !== undefined) && (
                      <div className="flex gap-3 text-xs text-zinc-500 mb-2">
                        {actor?.follower_count !== undefined && (
                          <span>{actor.follower_count.toLocaleString()} followers</span>
                        )}
                        {actor?.following_count !== undefined && (
                          <span>{actor.following_count.toLocaleString()} following</span>
                        )}
                      </div>
                    )}

                    {/* Cast Preview (if applicable) */}
                    {notification.cast?.text && (
                      <Link
                        href={`/cast/${notification.cast.hash}`}
                        className="block mt-2 p-3 bg-zinc-50 dark:bg-zinc-900/30 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900/50 transition-colors"
                      >
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-3">
                          {notification.cast.text}
                        </p>
                        {notification.cast.embeds && notification.cast.embeds.length > 0 && (
                          <div className="text-xs text-zinc-500 mt-1">
                            📎 {notification.cast.embeds.length} attachment{notification.cast.embeds.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </Link>
                    )}

                    {/* Timestamp */}
                    <div className="text-xs text-zinc-500 mt-2">
                      {formatTimestamp(notification.timestamp || notification.most_recent_timestamp || '')}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex flex-col gap-1">
                    {actor?.username && (
                      <Link
                        href={`/profile/${actor.username}`}
                        className="text-xs text-blue-500 hover:underline whitespace-nowrap"
                      >
                        View Profile
                      </Link>
                    )}
                    {notification.cast?.hash && (
                      <Link
                        href={`/cast/${notification.cast.hash}`}
                        className="text-xs text-blue-500 hover:underline whitespace-nowrap"
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

        {/* Load More */}
        {hasMore && cursor && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => {
                // Implement pagination here
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
