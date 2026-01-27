"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useNeynarContext } from "@neynar/react";
import NotificationBadge from "./NotificationBadge";

export default function BottomNav() {
  const pathname = usePathname();
  const [showCompose, setShowCompose] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useNeynarContext();

  // Wait for client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (path: string) => {
    return pathname === path;
  };

  // Don't render until mounted
  if (!mounted) {
    return null;
  }

  // Only show bottom nav if authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-800 z-50 pb-safe">
        <div className="max-w-screen-xl mx-auto px-2 sm:px-6 py-3">
          <div className="flex items-center justify-around gap-1">
            {/* Home */}
            <Link
              href="/"
              className={`flex flex-col items-center gap-1 transition-colors p-2 rounded-lg min-w-[56px] ${
                isActive("/")
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <svg
                className="w-6 h-6"
                fill={isActive("/") ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </Link>

            {/* Ask Homie */}
            <Link
              href="/ask-homie"
              className={`flex flex-col items-center gap-1 transition-colors p-2 rounded-lg min-w-[56px] ${
                isActive("/ask-homie")
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </Link>

            {/* Lists */}
            <Link
              href="/lists"
              className={`flex flex-col items-center gap-1 transition-colors p-2 rounded-lg min-w-[56px] ${
                isActive("/lists")
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
            </Link>

            {/* Trending */}
            <Link
              href="/trending"
              className={`flex flex-col items-center gap-1 transition-colors p-2 rounded-lg min-w-[56px] ${
                isActive("/trending")
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </Link>

            {/* Compose - Center Button (Prominent) */}
            <Link
              href="/compose"
              className="flex items-center justify-center w-11 h-11 bg-red-600 hover:bg-red-700 rounded-full transition-colors -mt-1"
            >
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </Link>

            {/* Notifications */}
            <div className="relative">
              <Link
                href="/notifications"
                className={`flex flex-col items-center gap-1 transition-colors ${
                  isActive("/notifications")
                    ? "text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <NotificationBadge className="w-6 h-6" />
              </Link>
            </div>

            {/* Profile */}
            <Link
              href="/profile"
              className={`flex flex-col items-center gap-1 transition-colors ${
                isActive("/profile")
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}
