"use client";

import { useEffect, useState } from 'react';

interface NotificationBadgeProps {
  className?: string;
  onView?: () => void;
}

export default function NotificationBadge({ className = '', onView }: NotificationBadgeProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();

    const tick = () => {
      if (document.visibilityState === 'visible') loadUnreadCount();
    };
    const interval = setInterval(tick, 60000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const loadUnreadCount = async () => {
    try {
      const storedProfile = localStorage.getItem('hh_profile');
      if (!storedProfile) return;
      const { fid } = JSON.parse(storedProfile);
      if (!fid) return;

      const lastViewed = localStorage.getItem('hh_last_notif_view');
      const lastViewedTime = lastViewed ? new Date(lastViewed) : new Date(0);

      const res = await fetch(`/api/notifications?fid=${fid}`);
      if (!res.ok) return;

      const data = await res.json();
      const unread = (data.notifications || []).filter((n: any) => {
        const t = new Date(n.timestamp || n.most_recent_timestamp || 0);
        return t > lastViewedTime;
      }).length;

      setUnreadCount(unread);
    } catch {
      // silently fail
    }
  };

  return (
    <span className={`relative inline-flex ${className}`}>
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-white text-black text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </span>
  );
}
