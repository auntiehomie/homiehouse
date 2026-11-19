'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Clip } from '@/lib/clips';

function ClipCard({ clip }: { clip: Clip }) {
  const player = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = player.current;
    if (!video || failed) return;
    let visible = false;
    const update = () => {
      if (!visible || document.hidden) video.pause();
      else if (!matchMedia('(prefers-reduced-motion: reduce)').matches) void video.play().catch(() => {});
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.intersectionRatio >= 0.7;
      update();
    }, { threshold: [0, 0.7] });
    observer.observe(video);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); video.pause(); };
  }, [failed]);
  return <article className="flex h-full snap-start snap-always flex-col bg-black text-white">
    {failed ? <div className="grid min-h-0 flex-1 place-content-center"><button onClick={() => setFailed(false)}>Video unavailable · Retry</button></div>
      : <video ref={player} src={clip.url} playsInline controls muted loop preload="metadata" aria-label={clip.caption || 'Video clip'}
        onError={() => setFailed(true)} className="min-h-0 w-full flex-1 object-contain" />}
    <div className="space-y-1 px-4 py-3">
      <Link className="font-semibold underline" href={'/cast/' + encodeURIComponent(clip.hash)}>View cast · FID {clip.fid}</Link>
      {clip.caption && <p className="line-clamp-3 break-words">{clip.caption}</p>}
    </div>
  </article>;
}

export default function ClipsPage() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  const load = useCallback(async (token?: string | null) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/clips' + (token ? '?cursor=' + encodeURIComponent(token) : ''), { signal: controller.signal });
      if (!response.ok) throw new Error();
      const page = await response.json();
      if (controller.signal.aborted) return;
      setClips(previous => Array.from(new Map<string, Clip>([...(token ? previous : []), ...page.clips].map(clip => [clip.hash, clip])).values()));
      setCursor(page.cursor === token ? null : page.cursor);
    } catch {
      if (!controller.signal.aborted) setError('Could not load clips.');
    } finally {
      if (pending.current === controller) { pending.current = null; setLoading(false); }
    }
  }, []);
  useEffect(() => {
    void load();
    return () => { pending.current?.abort(); pending.current = null; };
  }, [load]);
  return <main className="mx-auto max-w-xl px-3 pb-20">
    <header className="flex items-center justify-between py-3">
      <h1 className="text-3xl font-bold">Clips</h1>
      <Link className="rounded-full bg-white px-5 py-2 font-semibold text-black" href="/clips/new">+ Create clip</Link>
    </header>
    {clips.length > 0 && <section aria-label="Video clips" tabIndex={0} className="h-[min(78dvh,800px)] snap-y snap-mandatory overflow-y-auto rounded-2xl">
      {clips.map(clip => <ClipCard key={clip.hash} clip={clip} />)}
    </section>}
    <div className="py-4" aria-live="polite">
      {loading ? 'Loading clips…' : error ? <button onClick={() => load(cursor)}>{error} Retry</button>
        : cursor ? <button className="rounded-full border px-5 py-2" onClick={() => load(cursor)}>Load more clips</button>
        : !clips.length ? <p>No clips yet. Record the first one.</p> : null}
    </div>
  </main>;
}
