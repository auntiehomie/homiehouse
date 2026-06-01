'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ParentMeta {
  hash: string;
  authorUsername: string;
  text: string;
}

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
        text: (cast.text || '').slice(0, 200),
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

  if (meta === undefined) return null;

  if (meta === null) {
    return (
      <Link
        href={`/cast/${parentHash}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--muted-on-dark)', marginBottom: 8, textDecoration: 'none' }}
        onClick={e => e.stopPropagation()}
      >
        ↩ Replying to a cast
      </Link>
    );
  }

  return (
    <Link
      href={`/cast/${meta.hash}`}
      style={{
        display: 'block',
        marginBottom: 10,
        textDecoration: 'none',
        borderLeft: '3px solid rgba(255,255,255,0.15)',
        paddingLeft: 10,
        paddingTop: 4,
        paddingBottom: 4,
      }}
      onClick={e => e.stopPropagation()}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-on-dark)' }}>
        @{meta.authorUsername}
      </span>
      {meta.text && (
        <p style={{
          margin: '2px 0 0',
          fontSize: 13,
          color: 'var(--muted-on-dark)',
          lineHeight: 1.45,
          opacity: 0.85,
        }}>
          {meta.text}{meta.text.length >= 200 ? '…' : ''}
        </p>
      )}
    </Link>
  );
}
