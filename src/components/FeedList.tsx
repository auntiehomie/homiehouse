"use client";

import React, { useEffect, useState } from "react";
import { fetchFeed } from "../lib/farcaster";
import { useProfile } from "@farcaster/auth-kit";
import { FeedSkeleton } from "./Skeletons";
import { formatDistanceToNow } from "date-fns";

export default function FeedList() {
  const [items, setItems] = useState<any[] | null>(null);

  const { isAuthenticated, profile } = useProfile();

  useEffect(() => {
    let mounted = true;
    (async () => {
      // If the user is authenticated with AuthKit and we have an fid,
      // ask the server for a proxied feed (requires NEYNAR_API_KEY or similar)
      let res;
      try {
        const fid = (profile?.fid as any) ?? undefined;
        if (isAuthenticated && fid) {
          const feedRes = await fetch(`/api/feed?fid=${encodeURIComponent(String(fid))}`);
          if (feedRes.ok) {
            res = await feedRes.json();
            if (res?.data) res = res.data;
          } else {
            // fallback to host SDK if server can't provide feed
            res = await fetchFeed(20);
          }
        } else {
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
  }, [isAuthenticated, profile]);

  if (items === null)
    return (
      <div aria-busy="true" aria-live="polite">
        <FeedSkeleton count={3} />
      </div>
    );
  if (!items.length) return <div className="surface">No casts to show. Follow people to populate your feed.</div>;

  return (
    <div className="space-y-4">
      {items.map((it) => {
        const rawTs = it.timestamp ?? it.ts ?? it.time ?? null;
        const authorObj = it.author && typeof it.author === 'object' ? it.author : null;
        const authorName = authorObj?.display_name || authorObj?.username || it.author || it.handle || 'Unknown';
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
          <article key={key} className="surface">
            <div style={{ fontWeight: 700 }}>{authorName}</div>
            <div style={{ marginTop: 6 }}>{text}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted-on-dark)' }}>{timeLabel}</div>
          </article>
        );
      })}
    </div>
  );
}
