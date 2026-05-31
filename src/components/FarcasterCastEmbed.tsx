'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  hash: string;
  originalUrl: string;
}

export default function FarcasterCastEmbed({ hash, originalUrl }: Props) {
  const [cast, setCast] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/cast?hash=${encodeURIComponent(hash)}`)
      .then(r => r.json())
      .then(data => setCast(data.cast))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hash]);

  if (loading) {
    return <div className="h-16 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />;
  }

  if (!cast) {
    return (
      <a href={originalUrl} target="_blank" rel="noopener noreferrer"
        className="block p-3 rounded-lg border border-zinc-800 text-zinc-400 text-sm hover:bg-zinc-900 truncate">
        🔗 {originalUrl}
      </a>
    );
  }

  const author = cast.author;
  const name = author?.display_name || author?.username || 'Unknown';
  const username = author?.username || '';
  const pfp = author?.pfp_url;
  const text = cast.text || '';
  let time = '';
  try {
    const d = new Date(cast.timestamp);
    if (!isNaN(d.getTime())) time = formatDistanceToNow(d, { addSuffix: true });
  } catch {}

  return (
    <Link
      href={`/cast/${hash}`}
      className="block rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 hover:bg-zinc-900 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2 min-w-0">
        {pfp && <img src={pfp} alt={name} className="w-6 h-6 rounded-full shrink-0" />}
        <span className="text-sm font-medium text-zinc-300 truncate">{name}</span>
        <span className="text-xs text-zinc-500 shrink-0">@{username}</span>
        {time && <span className="text-xs text-zinc-600 ml-auto shrink-0">{time}</span>}
      </div>
      <p className="text-sm text-zinc-400 line-clamp-3 whitespace-pre-wrap break-words">{text}</p>
    </Link>
  );
}
