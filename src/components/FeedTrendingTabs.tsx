"use client";

import React, { useState } from "react";
import FeedList from "./FeedList";
import TrendingList from "./TrendingList";
import FeedCurationChat from "./FeedCurationChat";
import ChannelStrip from "./ChannelStrip";

export type FeedType = 'following' | 'global';

export default function FeedTrendingTabs() {
  const [tab, setTab] = useState<'feed'|'trending'>('feed');
  const [feedType, setFeedType] = useState<FeedType>('following');
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set());
  const [hiddenCasts, setHiddenCasts] = useState<Set<string>>(new Set());
  const [showCurationSettings, setShowCurationSettings] = useState(false);

  return (
    <div>
      <div className="flex gap-2 mb-4 items-center overflow-x-auto pb-1" style={{ flexWrap: 'nowrap', scrollbarWidth: 'none' }}>
        <button
          onClick={() => setTab('feed')}
          className={"btn text-sm shrink-0 " + (tab === 'feed' ? 'primary' : '')}
          style={{ padding: '8px 16px', minWidth: 'auto' }}
        >
          Feed
        </button>
        <button
          onClick={() => setTab('trending')}
          className={"btn text-sm shrink-0 " + (tab === 'trending' ? 'primary' : '')}
          style={{ padding: '8px 16px', minWidth: 'auto' }}
        >
          Trending
        </button>

        {tab === 'feed' && (
          <>
            <div className="w-px bg-zinc-700 h-5 mx-1 shrink-0" />
            <button
              onClick={() => { setFeedType('following'); setSelectedChannel(null); }}
              className={"btn text-xs shrink-0 " + (feedType === 'following' ? 'primary' : '')}
              style={{ padding: '6px 12px', minWidth: 'auto' }}
            >
              Following
            </button>
            <button
              onClick={() => { setFeedType('global'); setSelectedChannel(null); }}
              className={"btn text-xs shrink-0 " + (feedType === 'global' ? 'primary' : '')}
              style={{ padding: '6px 12px', minWidth: 'auto' }}
            >
              Global
            </button>
          </>
        )}
      </div>

      {selectedChannel && (
        <div className="flex items-center justify-between px-3 py-2 mb-4 rounded-lg bg-zinc-800 text-zinc-100">
          <span className="text-sm font-semibold">Viewing: {selectedChannel}</span>
          <button
            onClick={() => setSelectedChannel(null)}
            className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {tab === 'feed' && <ChannelStrip />}

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
