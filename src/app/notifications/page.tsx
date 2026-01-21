'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Notification {
  type: string;
  cast?: {
    hash: string;
    text: string;
    author: {
      username: string;
      display_name: string;
      pfp_url: string;
    };
  };
  user?: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
  };
  timestamp: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadNotifications = async () => {
      try {
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
      } catch (err) {
        console.error('Error loading notifications:', err);
        setError('Failed to load notifications');
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [router]);

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'likes':
        return `${notification.user?.display_name || notification.user?.username} liked your cast`;
      case 'recasts':
        return `${notification.user?.display_name || notification.user?.username} recasted your cast`;
      case 'follows':
        return `${notification.user?.display_name || notification.user?.username} followed you`;
      case 'mention':
        return `${notification.cast?.author?.display_name || notification.cast?.author?.username} mentioned you`;
      case 'reply':
        return `${notification.cast?.author?.display_name || notification.cast?.author?.username} replied to your cast`;
      default:
        return 'New notification';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-zinc-100">
        <header className="max-w-4xl mx-auto px-6 py-6 border-b border-zinc-800">
          <h1 className="text-2xl font-bold">Notifications</h1>
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
        <header className="max-w-4xl mx-auto px-6 py-6 border-b border-zinc-800">
          <h1 className="text-2xl font-bold">Notifications</h1>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-red-500">{error}</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-zinc-100">
      <header className="max-w-4xl mx-auto px-6 py-6 border-b border-zinc-800">
        <h1 className="text-2xl font-bold">Notifications</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">
        {notifications.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-zinc-500">No notifications yet</div>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-4 hover:bg-zinc-900/30 rounded-lg transition-colors"
              >
                <img
                  src={
                    notification.user?.pfp_url ||
                    notification.cast?.author?.pfp_url ||
                    '/default-avatar.png'
                  }
                  alt="Avatar"
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1">
                  <p className="text-sm">{getNotificationText(notification)}</p>
                  {notification.cast?.text && (
                    <p className="text-sm text-zinc-500 mt-1 line-clamp-2">
                      {notification.cast.text}
                    </p>
                  )}
                  <p className="text-xs text-zinc-600 mt-1">
                    {formatTimestamp(notification.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
