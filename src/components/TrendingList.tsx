"use client";

import React, { useEffect, useState } from "react";
import { TrendingSkeleton } from "./Skeletons";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface TrendingListProps {
  limit?: number;
}

export default function TrendingList({ limit = 10 }: TrendingListProps) {
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const params = new URLSearchParams({ limit: String(limit), time_window: "24h" });
        
        // Get FID from localStorage if available
        const storedProfile = localStorage.getItem("hh_profile");
        if (storedProfile) {
          try {
            const profile = JSON.parse(storedProfile);
            if (profile?.fid) {
              params.set("viewer_fid", String(profile.fid));
            }
          } catch {}
        }
        
        const res = await fetch(`/api/trending?${params.toString()}`);
        const data = await res.json();
        const casts = data?.data ?? [];
        if (mounted) setItems(Array.isArray(casts) ? casts : []);
      } catch (e) {
        if (mounted) setItems([]);
      }
    })();
    return () => { mounted = false; };
  }, [limit]);

  if (items === null)
    return (
      <div aria-busy="true" aria-live="polite">
        <TrendingSkeleton count={2} />
      </div>
    );
  if (!items.length) return <div className="surface">No trending casts.</div>;

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const authorObj = it?.author || it?.user || null;
        const authorName = authorObj?.display_name || authorObj?.username || "Unknown";
        const authorUsername = authorObj?.username || "";
        const authorPfp = authorObj?.pfp_url;
        const text = it?.text || it?.body || "";
        const castHash = it?.hash || "";
        const rawTs = it?.timestamp || it?.ts || it?.time || null;
        let timeLabel = "";
        if (rawTs) {
          try {
            const date = new Date(String(rawTs));
            if (!isNaN(date.getTime())) {
              timeLabel = formatDistanceToNow(date, { addSuffix: true });
            }
          } catch {}
        }

        return (
          <Link 
            key={castHash || it?.id || JSON.stringify(it)}
            href={`/cast/${castHash}`}
            className="block surface hover:border-orange-500 dark:hover:border-orange-600 transition-colors cursor-pointer"
          >
            {/* Author info with avatar */}
            <div className="flex items-center gap-3 mb-3">
              {authorPfp && (
                <img 
                  src={authorPfp} 
                  alt={authorName}
                  className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-zinc-700"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{authorName}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">@{authorUsername}</div>
              </div>
            </div>
            
            {/* Cast text */}
            <div style={{ 
              marginTop: 6, 
              wordWrap: 'break-word', 
              overflowWrap: 'break-word', 
              wordBreak: 'break-word',
              lineHeight: 1.5
            }}>
              {text.split(' ').slice(0, 10).join(' ')}{text.split(' ').length > 10 ? '...' : ''}
            </div>
            
            {/* Timestamp */}
            {timeLabel && (
              <div style={{ 
                marginTop: 6, 
                fontSize: 12, 
                color: 'var(--muted-on-dark)'
              }}>
                {timeLabel}
              </div>
            )}
            
            {/* Reaction counts */}
            {(it.reactions?.likes_count || it.reactions?.recasts_count) && (
              <div className="flex gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                {it.reactions?.likes_count > 0 && (
                  <span>❤️ {it.reactions.likes_count}</span>
                )}
                {it.reactions?.recasts_count > 0 && (
                  <span>🔁 {it.reactions.recasts_count}</span>
                )}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}