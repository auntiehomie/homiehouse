"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Channel {
  id: string;
  name: string;
  image_url?: string;
}

function channelDisplayName(ch: any): string {
  // Prefer name if it's not a raw URL
  const name = ch.name;
  if (name && !name.startsWith('http') && !name.startsWith('chain://')) return name;

  // Fall back to id if it's not a raw URL
  const id = ch.id;
  if (id && !id.startsWith('http') && !id.startsWith('chain://')) return id;

  // Both are URL-like — extract something readable
  const url = name || id || '';
  try {
    if (url.startsWith('chain://')) {
      // e.g. chain://eip155:1/erc721:0xabc → "erc721:0xabc" → last 8 chars
      const part = url.split('/').pop() || '';
      return part.split(':')[0] || 'channel';
    }
    const u = new URL(url);
    return (u.pathname.split('/').filter(Boolean).pop() || u.hostname.replace('www.', '')).slice(0, 12);
  } catch {
    return url.slice(0, 10) || 'channel';
  }
}

export default function ChannelStrip() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("hh_profile");
    if (!stored) { setLoaded(true); return; }
    const { fid } = JSON.parse(stored);
    if (!fid) { setLoaded(true); return; }

    fetch(`/api/channels?fid=${fid}&limit=30`)
      .then(r => r.json())
      .then(data => {
        const list: Channel[] = (data.channels || []).map((ch: any) => ({
          id: ch.id || ch.name,
          name: channelDisplayName(ch),
          image_url: ch.image_url || null,
        }));
        setChannels(list);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || channels.length === 0) return null;

  return (
    <div
      className="flex gap-3 mb-4 overflow-x-auto pb-1"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
    >
      {channels.map(ch => (
        <Link
          key={ch.id}
          href={`/channel/${ch.id}`}
          className="flex flex-col items-center gap-1 shrink-0 group"
          style={{ minWidth: 52 }}
        >
          <div className="w-12 h-12 rounded-full overflow-hidden border border-zinc-700 group-hover:border-zinc-400 transition-colors bg-zinc-800 flex items-center justify-center">
            {ch.image_url ? (
              <img
                src={ch.image_url}
                alt={ch.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-bold text-zinc-300 uppercase">
                {ch.name.slice(0, 2)}
              </span>
            )}
          </div>
          <span className="text-[9px] text-zinc-500 group-hover:text-zinc-300 transition-colors max-w-[52px] truncate text-center">
            {ch.name}
          </span>
        </Link>
      ))}
    </div>
  );
}
