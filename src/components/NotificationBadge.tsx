"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface NotificationBadgeProps {
  className?: string;
}

export default function NotificationBadge({ className = '' }: NotificationBadgeProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUnreadCount();

    // Poll for updates every 60 seconds
    const interval = setInterval(() => {
      loadUnreadCount();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const storedProfile = localStorage.getItem('hh_profile');
      if (!storedProfile) {
        setLoading(false);
        return;
      }

      const profile = JSON.parse(storedProfile);
      const fid = profile?.fid;

      if (!fid) {
        setLoading(false);
        return;
      }

      // Get last viewed timestamp from localStorage
      const lastViewed = localStorage.getItem('hh_last_notif_view');
      const lastViewedTime = lastViewed ? new Date(lastViewed) : new Date(0);

      const response = await fetch(`/api/notifications?fid=${fid}`);
      if (!response.ok) {
        setLoading(false);
        return;
      }

      const data = await response.json();
      const notifications = data.notifications || [];

      // Count notifications newer than last viewed
      const unread = notifications.filter((notif: any) => {
        const notifTime = new Date(notif.timestamp || notif.most_recent_timestamp || 0);
        return notifTime > lastViewedTime;
      }).length;

      setUnreadCount(unread);
    } catch (error) {
      console.error('Error loading unread count:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark notifications as viewed when clicking the badge
  const handleClick = () => {
    localStorage.setItem('hh_last_notif_view', new Date().toISOString());
    setUnreadCount(0);
  };

  return (
    <Link
      href="/notifications"
      onClick={handleClick}
      className={`relative ${className}`}
    >
      🔔
      {!loading && unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
