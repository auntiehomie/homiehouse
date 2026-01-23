"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import NotificationBadge from "./NotificationBadge";

export default function BottomNav() {
  const pathname = usePathname();
  const [showCompose, setShowCompose] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Safe Privy hook usage with fallback
  let ready = false;
  let authenticated = false;
  
  try {
    const privyState = usePrivy();
    ready = privyState.ready;
    authenticated = privyState.authenticated;
  } catch (error) {
    console.error('[BottomNav] Error using Privy hook:', error);
    // Fallback to checking localStorage
    if (typeof window !== 'undefined') {
      const profile = localStorage.getItem('hh_profile');
      authenticated = !!profile;
      ready = true;
    }
  }

  // Wait for client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (path: string) => {
    return pathname === path;
  };

  // Don't render until mounted and ready, and only if authenticated
  if (!mounted || !ready || !authenticated) {
    return null;
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-800 z-50">
        <div className="max-w-screen-xl mx-auto px-6 py-3">
          <div className="flex items-center justify-around">
            {/* Home */}
            <Link
              href="/"
              className={`flex flex-col items-center gap-1 transition-colors ${
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

            {/* Search / Ask Homie */}
            <Link
              href="/ask-homie"
              className={`flex flex-col items-center gap-1 transition-colors ${
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </Link>

            {/* Compose - Center Button (Prominent) */}
            <Link
              href="/compose"
              className="flex items-center justify-center w-12 h-12 bg-red-600 hover:bg-red-700 rounded-full transition-colors -mt-2"
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
                  strokeWidth={2.5}
                  d="M12 4v16m8-8H4"
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
