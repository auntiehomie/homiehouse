"use client";

import React, { useEffect, useState } from "react";
import FeedList from "./FeedList";
import TrendingList, { prefetchTrending } from "./TrendingList";
import FeedCurationChat from "./FeedCurationChat";
import { TooltipTrigger } from "@/lib/progressive-disclosure";

export type FeedScope = 'following' | 'global';

interface FeedTrendingTabsProps {
  /** Guests have no following graph, so default them to Trending instead of Feed/Following. */
  defaultTab?: 'feed' | 'trending';
  defaultFeedScope?: FeedScope;
}

export default function FeedTrendingTabs({ defaultTab = 'feed', defaultFeedScope = 'global' }: FeedTrendingTabsProps = {}) {
  // Lazily initialize from sessionStorage so FeedList gets the correct props
  // on the very first render — avoids a double-mount that breaks scroll restoration.
  const [tab, setTab] = useState<'feed'|'trending'>(() => {
    try {
      const raw = sessionStorage.getItem('hh_feed_return');
      if (raw) {
        const saved = JSON.parse(raw);
        if (Date.now() - Number(saved.ts || 0) < 10 * 60 * 1000) return 'feed';
      }
    } catch {}
    return defaultTab;
  });
  const [feedType, setFeedType] = useState<FeedScope>(() => {
    try {
      const raw = sessionStorage.getItem('hh_feed_return');
      if (raw) {
        const saved = JSON.parse(raw);
        if (
          Date.now() - Number(saved.ts || 0) < 10 * 60 * 1000 &&
          (saved.feedType === 'following' || saved.feedType === 'global')
        ) return saved.feedType;
      }
    } catch {}
    return defaultFeedScope;
  });
  const [selectedChannel, setSelectedChannel] = useState<string | null>(() => {
    try {
      const raw = sessionStorage.getItem('hh_feed_return');
      if (raw) {
        const saved = JSON.parse(raw);
        if (
          Date.now() - Number(saved.ts || 0) < 10 * 60 * 1000 &&
          typeof saved.selectedChannel === 'string'
        ) return saved.selectedChannel;
      }
    } catch {}
    return null;
  });
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set());
  const [hiddenCasts, setHiddenCasts] = useState<Set<string>>(new Set());
  const [showCurationSettings, setShowCurationSettings] = useState(false);

  useEffect(() => {
    prefetchTrending();
    // State is now initialized lazily from sessionStorage — no correction needed here.
  }, []);

  return (
    <div>
      <div className="flex gap-2 mb-4 items-center overflow-x-auto pb-1" style={{ flexWrap: 'nowrap', scrollbarWidth: 'none' }}>
        <button
          onClick={() => setTab('feed')}
          className={"btn text-sm shrink-0 " + (tab === 'feed' ? 'primary' : '')}
          style={{ padding: '8px 16px', minWidth: 'auto' }}
        >
          <TooltipTrigger termKey="cast">Feed</TooltipTrigger>
        </button>
        <button
          onClick={() => setTab('trending')}
          className={"btn text-sm shrink-0 " + (tab === 'trending' ? 'primary' : '')}
          style={{ padding: '8px 16px', minWidth: 'auto' }}
        >
          <TooltipTrigger termKey="cast">Trending</TooltipTrigger>
        </button>

        {tab === 'feed' && (
          <>
            <div className="w-px bg-zinc-700 h-5 mx-1 shrink-0" />
            <button
              onClick={() => { setFeedType('global'); setSelectedChannel(null); }}
              className={"btn text-xs shrink-0 " + (feedType === 'global' ? 'primary' : '')}
              style={{ padding: '6px 12px', minWidth: 'auto' }}
            >
              <TooltipTrigger termKey="cast">Global</TooltipTrigger>
            </button>
            <button
              onClick={() => { setFeedType('following'); setSelectedChannel(null); }}
              className={"btn text-xs shrink-0 " + (feedType === 'following' ? 'primary' : '')}
              style={{ padding: '6px 12px', minWidth: 'auto' }}
            >
              <TooltipTrigger termKey="cast">Following</TooltipTrigger>
            </button>
          </>
        )}
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

      <div>
        {tab === 'feed' ? (
          <FeedList 
            feedType={feedType}
            selectedChannel={selectedChannel}
            mutedUsers={mutedUsers}
            hiddenCasts={hiddenCasts}
            onMuteUser={(username: string) => setMutedUsers(prev => new Set([...prev, username]))}
            onHideCast={(hash: string) => setHiddenCasts(prev => new Set([...prev, hash]))}
          />
        ) : (
          <TrendingList />
        )}
      </div>

      {showCurationSettings && (
        <FeedCurationChat onClose={() => setShowCurationSettings(false)} />
      )}
    </div>
  );
}
