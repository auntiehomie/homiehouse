"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useNeynarContext } from "@/hooks/useNeynarCompat";
import NotificationBadge from "./NotificationBadge";

export default function BottomNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useNeynarContext();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(path + '/');
  };
  const cls = (path: string) =>
    `flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-colors text-[9px] font-medium no-underline ${
      isActive(path) ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-400"
    }`;
  const dot = (path: string) =>
    isActive(path) ? "w-1 h-1 rounded-full bg-zinc-400 mt-0.5" : "w-1 h-1 mt-0.5";

  if (!mounted) return null;
  if (!isAuthenticated) return null;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t pb-safe hh-bottom-nav" style={{ zIndex: 9500, pointerEvents: 'all', touchAction: 'manipulation' }}>
      <div className="max-w-screen-xl mx-auto px-1 py-1">
        <div className="flex items-center justify-around">

          {/* Cast */}
          <Link href="/compose" className={cls("/compose")} aria-label="Cast">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>Cast</span>
            <div className={dot("/compose")} />
          </Link>

          {/* Notifications */}
          <Link
            href="/notifications"
            className={cls("/notifications")}
            aria-label="Notifications"
            onClick={() => localStorage.setItem('hh_last_notif_view', new Date().toISOString())}
          >
            <NotificationBadge className="w-5 h-5" />
            <span>Alerts</span>
            <div className={dot("/notifications")} />
          </Link>

          {/* Feed */}
          <Link href="/" className={cls("/")} aria-label="Feed">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6-4h2" />
            </svg>
            <span>Feed</span>
            <div className={dot("/")} />
          </Link>

          {/* Knowledge / Notes */}
          <Link href="/notes" className={cls("/notes")} aria-label="Knowledge">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Notes</span>
            <div className={dot("/notes")} />
          </Link>

          {/* Learn */}
          <Link href="/learn" className={cls("/learn")} aria-label="Learn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
            </svg>
            <span>Learn</span>
            <div className={dot("/learn")} />
          </Link>

          {/* Settings */}
          <Link href="/settings" className={cls("/settings")} aria-label="Settings">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Settings</span>
            <div className={dot("/settings")} />
          </Link>

        </div>
      </div>
    </nav>
  );
}
