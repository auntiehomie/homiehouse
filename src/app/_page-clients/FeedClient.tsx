"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFarcasterAuth } from "@/lib/farcaster-auth";
import FeedTrendingTabs from "@/components/FeedTrendingTabs";
import SidebarNav from "@/components/SidebarNav";
// LearningHeroCard removed — feed page is pure Farcaster feed only.
// The home page (AuthenticatedHome) serves as the learning hub home base.
import SignInButton from "@/components/SignInButton";
import HHLogo from "@/components/HHLogo";
import NotificationBadge from "@/components/NotificationBadge";
import { useProStatus } from "@/hooks/useProStatus";

export default function FeedClient() {
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();
  const forceFollowing = searchParams.get('feed_type') === 'following';
  const { isAuthenticated } = useFarcasterAuth();
  const { fid: viewerFid } = useFarcasterAuth();
  const { isPro } = useProStatus();

  // Feed components consume viewerFid from useFarcasterAuth context directly;
  // the value is also available here for any feed-level logic in the future.
  void viewerFid;

  useEffect(() => { setMounted(true); }, []);


  if (!mounted) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
        <style>{`@keyframes hhSpin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'hhSpin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <header className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-wrap items-center gap-3">
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
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {isPro && (
              <Link
                href="/pro"
                style={{
                  padding: '3px 2px', borderRadius: 6,
                  background: 'transparent', border: 'none',
                  fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                  textDecoration: 'none', whiteSpace: 'nowrap',
                }}
                title="HomieHouse Pro"
              >
                ⚡ Pro
              </Link>
            )}
            <Link href="/search" className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors" title="Search" aria-label="Search">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </Link>
            {isAuthenticated && (
              <Link href="/notifications" className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors" title="Notifications" aria-label="Notifications">
                <NotificationBadge className="w-5 h-5" />
              </Link>
            )}
            <SignInButton />
          </div>
        </div>
      </header>

      {!isAuthenticated && (
        <div
          className="max-w-7xl mx-auto px-3 sm:px-6"
          style={{ paddingTop: 12 }}
        >
          <div
            className="flex items-center justify-between gap-3"
            style={{
              padding: '10px 16px', borderRadius: 12,
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>
              👀 Browsing as a guest — sign in to post, like, and follow
            </span>
            <SignInButton />
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-3 sm:px-6 pb-24">
        <div className="flex gap-6 items-start">
          <aside
            className="hidden lg:block shrink-0"
            style={{ width: 220, position: 'sticky', top: 72, maxHeight: 'calc(100vh - 90px)', overflowY: 'auto', scrollbarWidth: 'none' }}
          >
            <SidebarNav />
          </aside>
          <div className="flex-1 min-w-0 hh-feed-column">
            <section
              aria-labelledby="feed-learning-title"
              style={{ marginBottom: 18, padding: '14px 16px', borderRadius: 14, background: 'linear-gradient(120deg, color-mix(in srgb, var(--accent) 18%, var(--surface)), var(--surface))', border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--border))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}
            >
              <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                <h2 id="feed-learning-title" style={{ margin: 0, fontSize: 15, fontWeight: 750, color: 'var(--text-on-dark)' }}>Turn your feed into a learning path</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--muted-on-dark)' }}>
                  Build a lesson from any cast. Eligible signed-in learners can earn 100 HH2 by passing the quiz.
                </p>
              </div>
              <Link href="/learn" style={{ flexShrink: 0, padding: '8px 12px', borderRadius: 9, background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                Explore Learn & Earn →
              </Link>
            </section>
            <div className="flex items-center mb-3">
              <h3 className="text-lg font-semibold">Explore</h3>
            </div>
            {isAuthenticated ? (
              <FeedTrendingTabs key={`member-${viewerFid}-${forceFollowing ? 'following' : 'saved'}`} forceDefaultFeedScope={forceFollowing} />
            ) : (
              // Guests have no following graph, so start on ranked Discovery.
              <FeedTrendingTabs key="guest" defaultFeedScope="global" />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
