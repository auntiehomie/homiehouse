"use client";

import React, { useEffect, useState } from "react";
import { TooltipTrigger } from "@/lib/progressive-disclosure";
import { TrendingSkeleton } from "./Skeletons";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import Image from "next/image";

interface TrendingListProps {
  limit?: number;
  /** Scope trending to one channel (Farcaster's topic unit) instead of the global feed. */
  channelId?: string;
}

interface SponsoredCast {
  id: number;
  cast_hash: string;
}

function SponsoredCastCard({ sponsored }: { sponsored: SponsoredCast }) {
  const handleClick = () => {
    fetch('/api/sponsored-cast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sponsored.id }),
    }).catch(() => {});
  };

  return (
    <Link
      href={`/cast/${sponsored.cast_hash}`}
      onClick={handleClick}
      className="block surface hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors cursor-pointer"
      style={{ position: 'relative' }}
    >
      {/* Sponsored badge */}
      <div style={{
        position: 'absolute', top: 8, right: 8,
        padding: '2px 8px', borderRadius: 6,
        background: 'rgba(232,119,34,0.15)', border: '1px solid rgba(232,119,34,0.3)',
        fontSize: 10, fontWeight: 700, color: 'var(--accent)',
        letterSpacing: '0.05em',
      }}>
        Sponsored
      </div>

      <div style={{ padding: '12px 16px' }}>
        <div className="flex items-center gap-3 mb-3">
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--accent)', opacity: 0.2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>
            📢
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold truncate">Sponsored Cast</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Promoted content</div>
          </div>
        </div>

        <div style={{
          marginTop: 6, wordWrap: 'break-word', overflowWrap: 'break-word',
          wordBreak: 'break-word', lineHeight: 1.5, fontSize: 13,
          color: 'var(--muted-on-dark)',
        }}>
          Tap to view this promoted cast on Farcaster.
        </div>
      </div>
    </Link>
  );
}

export default function TrendingList({ limit = 10, channelId }: TrendingListProps) {
  const [items, setItems] = useState<any[] | null>(null);
  const [sponsored, setSponsored] = useState<SponsoredCast | null>(null);

  useEffect(() => {
    let mounted = true;
    setItems(null);
    setSponsored(null);
    (async () => {
      try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (channelId) params.set("channel_id", channelId);

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
        if (mounted) {
          setItems(Array.isArray(casts) ? casts : []);
          if (data?.sponsored) setSponsored(data.sponsored);
        }
      } catch (e) {
        if (mounted) setItems([]);
      }
    })();
    return () => { mounted = false; };
  }, [limit, channelId]);

  if (items === null)
    return (
      <div aria-busy="true" aria-live="polite">
        <TrendingSkeleton count={2} />
      </div>
    );
  if (!items.length && !sponsored) return <div className="surface">No trending casts{channelId ? ` in #${channelId}` : ""}.</div>;

  // Inject sponsored cast at position 3 (index 2) in the rendered list
  const renderItems: Array<{ type: 'cast' | 'sponsored'; data: any }> = items.map(it => ({ type: 'cast' as const, data: it }));
  if (sponsored) {
    const insertAt = Math.min(2, renderItems.length);
    renderItems.splice(insertAt, 0, { type: 'sponsored', data: sponsored });
  }

  return (
    <div className="space-y-3">
      {renderItems.map((entry, idx) => {
        if (entry.type === 'sponsored') {
          return <SponsoredCastCard key={`sponsored-${entry.data.id}`} sponsored={entry.data} />;
        }

        const it = entry.data;
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
            className="block surface hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors cursor-pointer"
          >
            {/* Author info with avatar */}
            <div className="flex items-center gap-3 mb-3">
              {authorPfp && (
                <Image src={authorPfp} alt={authorName} width={40} height={40} className="rounded-full border-2 border-gray-300 dark:border-zinc-700" style={{ objectFit: 'cover' }} />
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
                  <TooltipTrigger termKey="cast">
                    <span>❤️ {it.reactions.likes_count}</span>
                  </TooltipTrigger>
                )}
                {it.reactions?.recasts_count > 0 && (
                  <TooltipTrigger termKey="recast">
                    <span>🔁 {it.reactions.recasts_count}</span>
                  </TooltipTrigger>
                )}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}