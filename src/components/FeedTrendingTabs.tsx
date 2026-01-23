"use client";

import React, { useState } from "react";
import FeedList from "./FeedList";
import TrendingList from "./TrendingList";
import CurationSettings from "./CurationSettings";

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
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setTab('feed')}
          className={"btn " + (tab === 'feed' ? 'primary' : '')}
        >
          Feed
        </button>
        <button
          onClick={() => setTab('trending')}
          className={"btn " + (tab === 'trending' ? 'primary' : '')}
        >
          Trending
        </button>
        
        {tab === 'feed' && (
          <>
            <div style={{ width: '1px', background: 'var(--border)', margin: '0 4px' }} />
            <button
              onClick={() => { setFeedType('following'); setSelectedChannel(null); }}
              className={"btn " + (feedType === 'following' ? 'primary' : '')}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              Following
            </button>
            <button
              onClick={() => { setFeedType('global'); setSelectedChannel(null); }}
              className={"btn " + (feedType === 'global' ? 'primary' : '')}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              Global
            </button>
            <div style={{ width: '1px', background: 'var(--border)', margin: '0 4px' }} />
            <button
              onClick={() => setShowCurationSettings(true)}
              className="btn"
              style={{ fontSize: '13px', padding: '6px 12px' }}
              title="Customize your feed"
            >
              ⚙️ Curate
            </button>
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
        <CurationSettings onClose={() => setShowCurationSettings(false)} />
      )}
    </div>
  );
}
