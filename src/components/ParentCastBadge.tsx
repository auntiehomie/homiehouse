'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ParentMeta {
  hash: string;
  authorUsername: string;
  textPreview: string;
}

// Module-level cache so repeated parent_hashes don't re-fetch
const cache = new Map<string, ParentMeta | null>();
const inFlight = new Map<string, Promise<ParentMeta | null>>();

async function fetchParent(hash: string): Promise<ParentMeta | null> {
  if (cache.has(hash)) return cache.get(hash)!;
  if (inFlight.has(hash)) return inFlight.get(hash)!;

  const p = fetch(`/api/cast?hash=${encodeURIComponent(hash)}`)
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      const cast = data?.cast;
      if (!cast) { cache.set(hash, null); return null; }
      const meta: ParentMeta = {
        hash,
        authorUsername: cast.author?.username || cast.author?.fid || '?',
        textPreview: (cast.text || '').slice(0, 80),
      };
      cache.set(hash, meta);
      return meta;
    })
    .catch(() => { cache.set(hash, null); return null; })
    .finally(() => inFlight.delete(hash));

  inFlight.set(hash, p);
  return p;
}

export default function ParentCastBadge({ parentHash }: { parentHash: string }) {
  const [meta, setMeta] = useState<ParentMeta | null | undefined>(
    cache.has(parentHash) ? cache.get(parentHash) : undefined
  );

  useEffect(() => {
    if (meta !== undefined) return;
    fetchParent(parentHash).then(setMeta);
  }, [parentHash]);

  if (meta === undefined) return null; // loading — show nothing until resolved
  if (meta === null) {
    // Parent not found, just show a link to the hash
    return (
      <Link
        href={`/cast/${parentHash}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#666', marginBottom: 6, textDecoration: 'none' }}
        onClick={e => e.stopPropagation()}
      >
        ↩ Replying to a cast
      </Link>
    );
  }

  return (
    <Link
      href={`/cast/${meta.hash}`}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8, textDecoration: 'none' }}
      onClick={e => e.stopPropagation()}
    >
      <span style={{ color: '#555', fontSize: 12, marginTop: 1, flexShrink: 0 }}>↩</span>
      <span style={{
        fontSize: 12,
        color: '#666',
        borderLeft: '2px solid #333',
        paddingLeft: 8,
        lineHeight: 1.4,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      } as React.CSSProperties}>
        <span style={{ color: '#888', fontWeight: 600 }}>@{meta.authorUsername}</span>
        {meta.textPreview && (
          <span style={{ color: '#555' }}>{' '}{meta.textPreview}{meta.textPreview.length >= 80 ? '…' : ''}</span>
        )}
      </span>
    </Link>
  );
}
