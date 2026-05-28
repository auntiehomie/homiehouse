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

  const isActive = (path: string) => pathname === path;

  if (!mounted) return null;
  if (!isAuthenticated) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-800 z-50 pb-safe">
      <div className="max-w-screen-xl mx-auto px-6 py-3">
        <div className="flex items-center justify-around">

          {/* Cast */}
          <Link
            href="/compose"
            className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${
              isActive("/compose") ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
            aria-label="New cast"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </Link>

          {/* Notifications */}
          <Link
            href="/notifications"
            className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${
              isActive("/notifications") ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
            aria-label="Notifications"
          >
            <NotificationBadge className="w-6 h-6" />
          </Link>

          {/* Ask Homie */}
          <Link
            href="/ask-homie"
            className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${
              isActive("/ask-homie") ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
            aria-label="Ask Homie"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </Link>

          {/* Wallet */}
          <Link
            href="/profile"
            className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${
              isActive("/profile") ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
            aria-label="Wallet"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </Link>

        </div>
      </div>
    </nav>
  );
}
