'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';

interface Props {
  hash: string;
  /** Author username from the URL, when present — helps resolve short hashes. */
  username?: string | null;
  originalUrl: string;
}

/** Open an external URL in a way that works inside the Farcaster mini-app webview. */
function openExternal(url: string) {
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    window.location.href = url;
  }
}

export default function FarcasterCastEmbed({ hash, username, originalUrl }: Props) {
  const [cast, setCast] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams({ hash });
    if (username) qs.set('username', username);
    fetch(`/api/cast?${qs.toString()}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (alive) setCast(data?.cast ?? null); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [hash, username]);

  if (loading) {
    return <div className="h-16 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />;
  }

  // Couldn't hydrate the cast (e.g. short farcaster.xyz hash the node can't resolve).
  // Show a clean, tappable "cast on Farcaster" card instead of a raw URL string.
  if (!cast) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); openExternal(originalUrl); }}
        className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 hover:bg-zinc-900 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 grid place-items-center w-6 h-6 rounded-full bg-[#7c65c1] text-white text-[11px] font-bold">✦</span>
          <span className="text-sm font-medium text-zinc-300 truncate">
            {username ? `@${username}'s cast` : 'Cast'} on Farcaster
          </span>
          <span className="text-xs text-zinc-500 ml-auto shrink-0">Open ↗</span>
        </div>
      </button>
    );
  }

  const author = cast.author;
  const name = author?.display_name || author?.username || 'Unknown';
  const uname = author?.username || username || '';
  const pfp = author?.pfp_url;
  const text = cast.text || '';
  // Prefer the resolved full hash for internal navigation; fall back to the URL hash.
  const fullHash = cast.hash || hash;
  let time = '';
  try {
    const d = new Date(cast.timestamp);
    if (!isNaN(d.getTime())) time = formatDistanceToNow(d, { addSuffix: true });
  } catch {}

  return (
    <Link
      href={`/cast/${fullHash}`}
      className="block rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 hover:bg-zinc-900 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2 min-w-0">
        {pfp && <Image src={pfp} alt={name} width={24} height={24} className="rounded-full shrink-0" style={{ objectFit: 'cover' }} />}
        <span className="text-sm font-medium text-zinc-300 truncate">{name}</span>
        {uname && <span className="text-xs text-zinc-500 shrink-0">@{uname}</span>}
        {time && <span className="text-xs text-zinc-600 ml-auto shrink-0">{time}</span>}
      </div>
      <p className="text-sm text-zinc-400 line-clamp-3 whitespace-pre-wrap break-words">{text}</p>
    </Link>
  );
}
