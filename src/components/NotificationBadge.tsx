"use client";

import { useEffect, useState } from 'react';
import AppIcon from './AppIcon';

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
      <AppIcon name="notifications" className="w-full h-full" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-[var(--accent)] text-[var(--bg-dark)] text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </span>
  );
}
