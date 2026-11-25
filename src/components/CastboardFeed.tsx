'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import CastText from './CastText';
import type { BoardCast } from '@/lib/castboards';

export default function CastboardFeed({ slug }: { slug: string }) {
  const [casts, setCasts] = useState<BoardCast[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    void (async () => {
      try {
        const res = await fetch(`/api/castboards?board=${encodeURIComponent(slug)}`, { signal: controller.signal, cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load this castboard.');
        setCasts(data.casts); setFailed(data.failedChannels);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load this castboard.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [slug, refresh]);
  return <section aria-label="Castboard conversations">
    <button className="btn mb-4" disabled={loading} onClick={() => setRefresh(n => n + 1)}>Refresh castboard</button>
    {loading ? <p role="status">Loading conversations…</p> : error ? <p role="alert">{error}</p> : <>
      {failed.length > 0 && <p role="status" className="mb-4">Some channels could not load: {failed.map(id => `/${id}`).join(', ')}. Refresh to retry.</p>}
      {!casts.length && <p>No casts returned for this sample. Try a channel directly or refresh later.</p>}
      <div className="grid gap-3">{casts.map(cast => <article key={cast.hash} className="surface rounded-xl p-4">
        <div className="flex justify-between gap-3 mb-3 text-sm">
          <strong>{cast.author?.display_name || cast.author?.username || 'Community member'}</strong>
          <Link href={`/channel/${encodeURIComponent(cast.castboardChannel)}`}>/{cast.castboardChannel}</Link>
        </div>
        <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><CastText cast={cast} /></div>
        <Link className="inline-block mt-3 underline text-sm" href={`/cast/${encodeURIComponent(cast.hash)}`}>Open conversation →</Link>
      </article>)}</div>
    </>}
  </section>;
}
