"use client";

import React, { useState } from "react";
import FeedList from "./FeedList";
import TrendingList from "./TrendingList";

export default function FeedTrendingTabs() {
  const [tab, setTab] = useState<'feed'|'trending'>('feed');

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
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
      </div>

      <div>
        {tab === 'feed' ? <FeedList /> : <TrendingList />}
      </div>
    </div>
  );
}
