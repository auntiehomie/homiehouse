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

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');
  const cls = (path: string) =>
    `flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-colors text-[9px] font-medium ${
      isActive(path) ? "text-white" : "text-zinc-500 hover:text-zinc-300"
    }`;

  if (!mounted) return null;
  if (!isAuthenticated) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-800 z-50 pb-safe">
      <div className="max-w-screen-xl mx-auto px-1 py-1">
        <div className="flex items-center justify-around">

          {/* Cast */}
          <Link href="/compose" className={cls("/compose")} aria-label="Cast">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>Cast</span>
          </Link>

          {/* Notifications */}
          <Link href="/notifications" className={cls("/notifications")} aria-label="Notifications">
            <NotificationBadge className="w-5 h-5" />
            <span>Alerts</span>
          </Link>

          {/* Ask Homie */}
          <Link href="/ask-homie" className={cls("/ask-homie")} aria-label="Ask Homie">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Homie</span>
          </Link>

          {/* Channels */}
          <Link href="/lists" className={cls("/lists")} aria-label="Lists & Channels">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Lists</span>
          </Link>

          {/* Profile */}
          <Link href="/profile" className={cls("/profile")} aria-label="Profile">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Profile</span>
          </Link>

        </div>
      </div>
    </nav>
  );
}
