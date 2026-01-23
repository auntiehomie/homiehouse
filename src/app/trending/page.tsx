"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import TrendingList from "../../components/TrendingList";
import PrivySignIn from "../../components/PrivySignIn";

export default function TrendingPage() {
  const [mounted, setMounted] = useState(false);
  
  // Safe Privy hook usage with fallback
  let ready = false;
  let authenticated = false;
  
  try {
    const privyState = usePrivy();
    ready = privyState.ready;
    authenticated = privyState.authenticated;
  } catch (error) {
    console.error('[Trending] Error using Privy hook:', error);
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

  // Prevent hydration mismatch - show nothing until mounted and Privy ready
  if (!mounted || !ready) {
    return null;
  }

  // Redirect to home if not authenticated
  if (!authenticated) {
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
          <PrivySignIn />
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
