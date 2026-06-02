"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Channel {
  id: string;
  name: string;
  image_url?: string;
}

function channelDisplayName(ch: any): string {
  const name = ch.name;
  if (name && !name.startsWith('http') && !name.startsWith('chain://')) return name;
  const id = ch.id;
  if (id && !id.startsWith('http') && !id.startsWith('chain://')) return id;
  const url = name || id || '';
  try {
    if (url.startsWith('chain://')) {
      const part = url.split('/').pop() || '';
      return part.split(':')[0] || 'channel';
    }
    const u = new URL(url);
    return (u.pathname.split('/').filter(Boolean).pop() || u.hostname.replace('www.', '')).slice(0, 12);
  } catch {
    return url.slice(0, 10) || 'channel';
  }
}

function useChannels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("hh_profile");
    if (!stored) { setLoaded(true); return; }
    const { fid } = JSON.parse(stored);
    if (!fid) { setLoaded(true); return; }

    fetch(`/api/channels?fid=${fid}&limit=200`)
      .then(r => r.json())
      .then(data => {
        const list: Channel[] = (data.channels || [])
          .filter((ch: any) => {
            const id = ch.id || ch.name || '';
            return id && !id.startsWith('http') && !id.startsWith('chain://');
          })
          .map((ch: any) => ({
            id: ch.id || ch.name,
            name: channelDisplayName(ch),
            image_url: ch.image_url || ch.imageUrl || ch.image || null,
          }));
        setChannels(list);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return { channels, loaded };
}

// ── Horizontal strip (mobile / tablet) ───────────────────────────────────────

export default function ChannelStrip() {
  const { channels, loaded } = useChannels();
  if (!loaded || channels.length === 0) return null;

  return (
    <div className="relative mb-4">
      <div
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent', WebkitOverflowScrolling: 'touch' }}
      >
        {channels.map(ch => (
          <Link
            key={ch.id}
            href={`/channel/${ch.id}`}
            className="flex flex-col items-center gap-1 shrink-0 group"
            style={{ minWidth: 52 }}
          >
            <div
              className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center transition-opacity group-hover:opacity-80"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              {ch.image_url ? (
                <img src={ch.image_url} alt={ch.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-on-dark)' }}>
                  {ch.name.slice(0, 2)}
                </span>
              )}
            </div>
            <span className="text-[9px] max-w-[52px] truncate text-center" style={{ color: 'var(--muted-on-dark)' }}>
              {ch.name}
            </span>
          </Link>
        ))}
      </div>
      {/* Fade indicator that more channels exist to the right */}
      <div
        className="absolute top-0 right-0 bottom-2 w-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right, transparent, var(--bg-dark))' }}
      />
    </div>
  );
}

// ── Vertical sidebar (desktop) ────────────────────────────────────────────────

export function ChannelSidebar() {
  const { channels, loaded } = useChannels();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-on-dark)', padding: '0 8px 8px' }}>
        Channels
      </div>
      {!loaded && (
        <div style={{ padding: '8px', fontSize: 12, color: 'var(--muted-on-dark)' }}>Loading…</div>
      )}
      {loaded && channels.length === 0 && (
        <div style={{ padding: '8px', fontSize: 12, color: 'var(--muted-on-dark)' }}>No channels yet</div>
      )}
      {channels.map(ch => (
        <Link
          key={ch.id}
          href={`/channel/${ch.id}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '7px 8px', borderRadius: 8,
            color: 'var(--muted-on-dark)',
            textDecoration: 'none',
            transition: 'background 0.12s, color 0.12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-on-dark)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--muted-on-dark)'; }}
        >
          <div
            style={{
              width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
              border: '1px solid var(--border)', background: 'var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {ch.image_url ? (
              <img src={ch.image_url} alt={ch.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-on-dark)' }}>
                {ch.name.slice(0, 2)}
              </span>
            )}
          </div>
          <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ch.name}
          </span>
        </Link>
      ))}
    </div>
  );
}
