"use client";

import { useState, useEffect } from "react";
import { useNeynarContext } from "@neynar/react";
import Link from "next/link";
import TrendingList from "../../components/TrendingList";
import NeynarSignIn from "../../components/NeynarSignIn";

export default function TrendingPage() {
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useNeynarContext();

  // Wait for client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch - show nothing until mounted
  if (!mounted) {
    return null;
  }

  // Redirect to home if not authenticated
  if (!isAuthenticated) {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-zinc-100">
      <header className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-zinc-500 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold">Trending</h1>
          </div>
          <NeynarSignIn />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pb-24">
        <div className="mb-4">
          <p className="text-zinc-600 dark:text-zinc-400">
            See what's hot on Farcaster right now
          </p>
        </div>
        
        <TrendingList limit={25} />
      </main>
    </div>
  );
}
