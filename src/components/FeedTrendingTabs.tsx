"use client";

import React, { useState } from "react";
import Link from "next/link";
import FeedList from "./FeedList";
import { DEFAULT_MEMBER_FEED } from '@/lib/feed-policy';
import { readFeedReturn } from "@/lib/feed-session";

export type FeedScope = 'following' | 'global' | 'community';

interface FeedTrendingTabsProps {
  defaultFeedScope?: FeedScope;
  forceDefaultFeedScope?: boolean;
}

export default function FeedTrendingTabs({ defaultFeedScope = DEFAULT_MEMBER_FEED, forceDefaultFeedScope = false }: FeedTrendingTabsProps = {}) {
  // Use the same memory-backed return state as the list, even if storage is full.
  const [feedType, setFeedType] = useState<FeedScope>(() => forceDefaultFeedScope ? defaultFeedScope : readFeedReturn()?.feedType ?? defaultFeedScope);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(() => forceDefaultFeedScope ? null : readFeedReturn()?.selectedChannel ?? null);
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set());
  const [hiddenCasts, setHiddenCasts] = useState<Set<string>>(new Set());

  return (
    <div>
      <nav aria-label="Learn, earn and connect" className="flex flex-wrap gap-2 mb-4 text-sm">
        <Link href="/learn" className="btn text-xs" style={{ padding: '8px 12px' }}>📚 Learn</Link>
        <Link href="/shop" className="btn text-xs" style={{ padding: '8px 12px' }}>✨ Earn & redeem</Link>
        <Link href="/community" className="btn text-xs" style={{ padding: '8px 12px' }}>🤝 Connect</Link>
      </nav>
      <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: '0 0 12px' }}>
        {feedType === 'community' ? 'Community · context, activity and freshness ranked' : feedType === 'following' ? 'Following · newest first from Hypersnap' : 'Discovery · ranked casts, not every network post'}
        {' · Automated spam filtering is temporarily off. Your mute and hide choices still apply.'}
      </p>
      <div aria-label="Feed views" className="hh-feed-tabs">
        <button className="btn" aria-pressed={feedType === 'following'} onClick={() => { setFeedType('following'); setSelectedChannel(null); }}>Following</button>
        <button className="btn" aria-pressed={feedType === 'global'} onClick={() => { setFeedType('global'); setSelectedChannel(null); }} title="Ranked discovery, not the newest network casts">Discovery</button>
        <button className="btn" aria-pressed={feedType === 'community'} onClick={() => { setFeedType('community'); setSelectedChannel(null); }}>Community</button>
      </div>

      {feedType === 'community' && (
        <details className="surface" style={{ marginBottom: 12, fontSize: 13 }}>
          <summary>How Community ranks casts</summary>
          <p>The current ranking balances sampled casting history, participation, engagement and freshness, with small bonuses for reply context and attachments. Every fifth position offers discovery space when a less-engaged author is available. EigenTrust is a planned extra trust signal, not a replacement for these signals or topic relevance.</p>
          <p>Community reorders each Hypersnap trending page. It cannot see every network cast or verify authenticity, truth, or reply quality. History uses up to 50 recent casts per author, so it may miss years of activity. Missing history receives neutral scores. Casts are reordered, not removed.</p>
          <p>Use “Why this cast?” to see the signals. Following remains newest first.</p>
        </details>
      )}

      {selectedChannel && (
        <div className="flex items-center justify-between px-3 py-2 mb-4 rounded-lg surface">
          <span className="text-sm font-semibold">Viewing: {selectedChannel}</span>
          <button
            onClick={() => setSelectedChannel(null)}
            className="text-xs px-2 py-1 rounded btn"
          >
            Clear
          </button>
        </div>
      )}

      <div>
          <FeedList 
            feedType={feedType}
            selectedChannel={selectedChannel}
            mutedUsers={mutedUsers}
            hiddenCasts={hiddenCasts}
            onMuteUser={(username: string) => setMutedUsers(prev => new Set([...prev, username]))}
            onHideCast={(hash: string) => setHiddenCasts(prev => new Set([...prev, hash]))}
          />
      </div>


    </div>
  );
}
