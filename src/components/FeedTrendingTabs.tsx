"use client";

import React, { startTransition, useState, ViewTransition } from "react";
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

  function selectFeedScope(nextScope: FeedScope) {
    if (nextScope === feedType && selectedChannel === null) return;
    startTransition(() => {
      setFeedType(nextScope);
      setSelectedChannel(null);
    });
  }

  return (
    <div>
      <nav aria-label="Learn, earn and connect" className="hh-feed-shortcuts flex flex-wrap gap-2 mb-4 text-sm">
        <Link href="/learn" className="btn text-xs">📚 Learn</Link>
        <Link href="/hh2#how-to-earn" className="btn text-xs">✨ Earn & redeem</Link>
        <Link href="/community" className="btn text-xs">🤝 Connect</Link>
      </nav>
      <div aria-label="Feed views" className="hh-feed-tabs">
        <button className="btn" aria-pressed={feedType === 'following'} onClick={() => selectFeedScope('following')}>Following</button>
        <button className="btn" aria-pressed={feedType === 'global'} onClick={() => selectFeedScope('global')}>Discovery</button>
        <button className="btn" aria-pressed={feedType === 'community'} onClick={() => selectFeedScope('community')}>Community</button>
      </div>

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

      <ViewTransition
        key={`${feedType}:${selectedChannel ?? ''}`}
        enter="hh-feed-enter"
        exit="hh-feed-exit"
        default="none"
      >
          <FeedList 
            feedType={feedType}
            selectedChannel={selectedChannel}
            mutedUsers={mutedUsers}
            hiddenCasts={hiddenCasts}
            onMuteUser={(username: string) => setMutedUsers(prev => new Set([...prev, username]))}
            onHideCast={(hash: string) => setHiddenCasts(prev => new Set([...prev, hash]))}
          />
      </ViewTransition>


    </div>
  );
}
