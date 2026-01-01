"use client";

import React, { useEffect, useState } from "react";
import { fetchFeed } from "../lib/farcaster";
import { useProfile } from "@farcaster/auth-kit";
import { FeedSkeleton } from "./Skeletons";
import { formatDistanceToNow } from "date-fns";
import { FeedType } from "./FeedTrendingTabs";

interface FeedListProps {
  feedType: FeedType;
  selectedChannel: string | null;
  mutedUsers: Set<string>;
  hiddenCasts: Set<string>;
  onMuteUser: (username: string) => void;
  onHideCast: (hash: string) => void;
}

export default function FeedList({ 
  feedType, 
  selectedChannel, 
  mutedUsers, 
  hiddenCasts,
  onMuteUser,
  onHideCast
}: FeedListProps) {
  const [items, setItems] = useState<any[] | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);

  const { isAuthenticated, profile } = useProfile();

  useEffect(() => {
    let mounted = true;
    (async () => {
      let res;
      try {
        const fid = (profile?.fid as any) ?? undefined;
        
        // Build query params based on feed type and channel
        let url = `/api/feed?feed_type=${feedType}`;
        if (fid) url += `&fid=${encodeURIComponent(String(fid))}`;
        if (selectedChannel) url += `&channel=${encodeURIComponent(selectedChannel)}`;
        
        const feedRes = await fetch(url);
        if (feedRes.ok) {
          res = await feedRes.json();
          if (res?.data) res = res.data;
        } else {
          // fallback to host SDK if server can't provide feed
          res = await fetchFeed(20);
        }
      } catch (e) {
        res = await fetchFeed(20);
      }

      if (mounted) setItems(res);
    })();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, profile, feedType, selectedChannel]);

  if (items === null)
    return (
      <div aria-busy="true" aria-live="polite">
        <FeedSkeleton count={3} />
      </div>
    );
  if (!items.length) return <div className="surface">No casts to show. Follow people to populate your feed.</div>;

  // Filter out muted users and hidden casts
  const filteredItems = items.filter((it) => {
    const authorObj = it.author && typeof it.author === 'object' ? it.author : null;
    const authorUsername = authorObj?.username || it.author || it.handle;
    const castHash = it.hash || it.id;
    
    if (authorUsername && mutedUsers.has(authorUsername)) return false;
    if (castHash && hiddenCasts.has(castHash)) return false;
    
    return true;
  });

  return (
    <div className="space-y-4">
      {filteredItems.map((it) => {
        const rawTs = it.timestamp ?? it.ts ?? it.time ?? null;
        const authorObj = it.author && typeof it.author === 'object' ? it.author : null;
        const authorName = authorObj?.display_name || authorObj?.username || it.author || it.handle || 'Unknown';
        const authorUsername = authorObj?.username || it.author || it.handle;
        const text = typeof it.text === 'string' ? it.text : (it.body ?? (typeof it.message === 'string' ? it.message : null)) ?? JSON.stringify(it);
        const key = it.hash || it.id || JSON.stringify({ h: it.hash, t: rawTs, a: authorName }).slice(0, 64);
        let timeLabel = "";
        if (rawTs) {
          try {
            let date: Date;
            if (typeof rawTs === 'number') {
              // seconds? milliseconds?
              date = new Date(rawTs > 1e12 ? rawTs : rawTs * 1000);
            } else {
              date = new Date(String(rawTs));
            }
            if (!isNaN(date.getTime())) {
              timeLabel = formatDistanceToNow(date, { addSuffix: true });
            } else {
              timeLabel = String(rawTs);
            }
          } catch (e) {
            timeLabel = String(rawTs);
          }
        }

        return (
          <article key={key} className="surface" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ fontWeight: 700 }}>{authorName}</div>
              <button
                onClick={() => setShowActions(showActions === key ? null : key)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted-on-dark)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '0 8px'
                }}
              >
                ⋯
              </button>
            </div>
            {showActions === key && (
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'var(--bg-dark)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px',
                zIndex: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}>
                <button
                  onClick={() => {
                    onHideCast(key);
                    setShowActions(null);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--foreground)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Hide this cast
                </button>
                {authorUsername && (
                  <button
                    onClick={() => {
                      onMuteUser(authorUsername);
                      setShowActions(null);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--foreground)',
                      cursor: 'pointer',
                      fontSize: '14px',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Mute @{authorUsername}
                  </button>
                )}
              </div>
            )}
            <div style={{ marginTop: 6 }}>{text}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted-on-dark)' }}>{timeLabel}</div>
          </article>
        );
      })}
    </div>
  );
}
