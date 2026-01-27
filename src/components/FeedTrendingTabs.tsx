"use client";

import React, { useState } from "react";
import FeedList from "./FeedList";
import TrendingList from "./TrendingList";
import FeedCurationChat from "./FeedCurationChat";

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
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <button
          onClick={() => setTab('feed')}
          className={"btn text-sm sm:text-base " + (tab === 'feed' ? 'primary' : '')}
          style={{ padding: '8px 16px', minWidth: 'auto' }}
        >
          Feed
        </button>
        <button
          onClick={() => setTab('trending')}
          className={"btn text-sm sm:text-base " + (tab === 'trending' ? 'primary' : '')}
          style={{ padding: '8px 16px', minWidth: 'auto' }}
        >
          Trending
        </button>
        
        {tab === 'feed' && (
          <>
            <div className="hidden sm:block w-px bg-zinc-200 dark:bg-zinc-800 h-6 mx-1" />
            <button
              onClick={() => { setFeedType('following'); setSelectedChannel(null); }}
              className={"btn text-xs sm:text-sm " + (feedType === 'following' ? 'primary' : '')}
              style={{ padding: '6px 12px', minWidth: 'auto' }}
            >
              Following
            </button>
            <button
              onClick={() => { setFeedType('global'); setSelectedChannel(null); }}
              className={"btn text-xs sm:text-sm " + (feedType === 'global' ? 'primary' : '')}
              style={{ padding: '6px 12px', minWidth: 'auto' }}
            >
              Global
            </button>
            <div className="hidden sm:block w-px bg-zinc-200 dark:bg-zinc-800 h-6 mx-1" />
            <a
              href="/lists"
              className="btn text-xs sm:text-sm"
              style={{ padding: '6px 12px', minWidth: 'auto' }}
            >
              📝 Lists
            </a>
          </>
        )}
      </div>

      {selectedChannel && (
        <div style={{ 
          padding: '8px 12px', 
          background: 'var(--accent)', 
          color: 'white',
          borderRadius: '8px', 
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Viewing: {selectedChannel}</span>
          <button 
            onClick={() => setSelectedChannel(null)}
            style={{ 
              background: 'rgba(255,255,255,0.2)', 
              border: 'none',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
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
