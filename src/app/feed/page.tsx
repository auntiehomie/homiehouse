"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useNeynarContext } from "@/hooks/useNeynarCompat";
import FeedTrendingTabs from "@/components/FeedTrendingTabs";
import SidebarNav from "@/components/SidebarNav";
import LearningHeroCard from "@/components/LearningHeroCard";
import NeynarSignIn from "@/components/NeynarSignIn";
import HHLogo from "@/components/HHLogo";
import NotificationBadge from "@/components/NotificationBadge";

export default function FeedPage() {
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useNeynarContext();

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
        <style>{`@keyframes hhSpin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'hhSpin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-dark)', color: 'var(--text-on-dark)' }}>
        <div className="text-center">
          <p style={{ color: 'var(--muted-on-dark)', marginBottom: 16 }}>Sign in to view your feed</p>
          <NeynarSignIn />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <header className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 flex items-center gap-2">
            <Link href="/learn">
              <HHLogo size={36} />
            </Link>
            <p className="text-xs text-zinc-500 hidden lg:block">Community Feed</p>
          </div>
          <div className="hidden lg:block flex-1 max-w-xs">
            <input
              id="header-search-input"
              placeholder="Search people..."
              className="w-full px-3 py-2 rounded-lg bg-transparent text-inherit text-sm"
              style={{ border: '1px solid var(--border)' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) window.location.href = `/search?q=${encodeURIComponent(v)}`;
                }
              }}
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Link href="/search" className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center hover:border-zinc-500 transition-colors" title="Search">
              <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </Link>
            <Link href="/notifications" className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center hover:border-zinc-500 transition-colors text-zinc-400" title="Notifications">
              <NotificationBadge className="w-4 h-4" />
            </Link>
            <NeynarSignIn />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 pb-24">
        <div className="flex gap-6 items-start">
          <aside
            className="hidden lg:block shrink-0"
            style={{ width: 220, position: 'sticky', top: 72, maxHeight: 'calc(100vh - 90px)', overflowY: 'auto', scrollbarWidth: 'none' }}
          >
            <SidebarNav />
          </aside>
          <div className="flex-1 min-w-0">
            <LearningHeroCard />
            <div className="flex items-center mb-3">
              <h3 className="text-lg font-semibold">Explore</h3>
            </div>
            <FeedTrendingTabs />
          </div>
        </div>
      </main>
    </div>
  );
}
