'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { useFarcasterWrites } from '@/hooks/useFarcasterWrites';
import { requirePostingAuthHeaders } from '@/lib/client-auth';
import { castTextBytes, MAX_CAST_BYTES } from '@/lib/cast-text';
import { CLIPS_PARENT, CLIP_FORMATS, CLIP_LIMIT } from '@/lib/clips';

async function upload(file: File) {
  const sign = await fetch('/api/clips/upload', { method: 'POST', headers: { ...await requirePostingAuthHeaders() } });
  const ticket = await sign.json();
  if (!sign.ok) throw new Error(ticket.error || 'Could not start upload.');
  const form = new FormData();
  form.append('file', file);
  form.append('network', 'public');
  const result = await fetch(ticket.url, { method: 'POST', body: form, signal: AbortSignal.timeout(300000) });
  if (!result.ok) throw new Error('Video upload failed. Please try again.');
  const cid = (await result.json()).data?.cid;
  if (typeof cid !== 'string' || !/^[a-z0-9]+$/i.test(cid)) throw new Error('Storage did not return a video.');
  const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud';
  const url = new URL('/ipfs/' + cid, gateway);
  url.searchParams.set('filename', 'clip.' + CLIP_FORMATS[file.type as keyof typeof CLIP_FORMATS]);
  return url.href;
}

function checkPlayback(url: string) {
  return new Promise<void>((resolve, reject) => {
    const player = document.createElement('video');
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      player.onloadedmetadata = player.onerror = null;
      player.removeAttribute('src');
      player.load();
      if (ok) resolve();
      else reject(new Error('The public video is not playable yet. Try posting again.'));
    };
    const timer = setTimeout(() => finish(false), 20000);
    player.onloadedmetadata = () => finish(player.videoWidth > 0);
    player.onerror = () => finish(false);
    player.preload = 'metadata';
    player.src = url;
  });
}

export default function NewClip() {
  const { fid } = useFarcasterAuth();
  const { hasActiveSigner, requestSigner, submitCast } = useFarcasterWrites();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [ready, setReady] = useState(false);
  const [caption, setCaption] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [posted, setPosted] = useState(false);
  const [hash, setHash] = useState('');
  const lock = useRef(false);
  const remote = useRef('');
  const bytes = castTextBytes(caption.trim());
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function choose(next?: File) {
    if (!next || lock.current) return;
    if (!Object.hasOwn(CLIP_FORMATS, next.type) || !next.size || next.size > CLIP_LIMIT) {
      setStatus('Choose an MP4, MOV, or WebM video up to 50 MiB.');
      return;
    }
    if (next === file) return;
    remote.current = '';
    setReady(false);
    setStatus('');
    setFile(next);
  }

  async function post() {
    if (!file || !ready || lock.current || posted || bytes > MAX_CAST_BYTES) return;
    lock.current = true;
    setBusy(true);
    try {
      if (!remote.current) {
        setStatus('Uploading video…');
        remote.current = await upload(file);
      }
      setStatus('Checking public playback…');
      await checkPlayback(remote.current);
      setStatus('Posting your clip…');
      const result = await submitCast({ text: caption.trim(), embeds: [{ url: remote.current }], parentUrl: CLIPS_PARENT });
      setHash(result.castHash);
      setPosted(true);
      setStatus('Clip posted.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not post this clip.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const button = 'inline-flex items-center justify-center rounded-full border px-5 py-3 font-semibold';
  return <main className="mx-auto max-w-xl space-y-5 p-5 pb-24">
    <Link href="/clips">← Clips</Link>
    <h1 className="text-3xl font-bold">Create a clip</h1>
    {posted ? <div className="space-y-4"><p role="status">{status}</p>
      {hash && <Link className={button} href={'/cast/' + encodeURIComponent(hash)}>View your cast</Link>}
      </div> : !fid ? <Link className={button} href="/">Sign in to post</Link> : <>
      <fieldset disabled={busy} className="flex flex-wrap gap-2">
        {['Record video', 'Choose video'].map((label, i) => <label key={label} className={button + ' cursor-pointer focus-within:ring-2'}>
          {label}<input className="sr-only" type="file" accept={Object.keys(CLIP_FORMATS).join(',')}
            capture={i === 0 ? 'environment' : undefined} onChange={event => { choose(event.target.files?.[0]); event.target.value = ''; }} />
        </label>)}
      </fieldset>
      <p className="text-sm">Up to 50 MiB · MP4, MOV, or WebM</p>
      {preview && <video key={preview} controls playsInline src={preview} className="max-h-[48dvh] w-full rounded-2xl bg-black" onLoadedMetadata={event => setReady(event.currentTarget.videoWidth > 0)}
        onError={() => { setReady(false); setStatus('This device cannot play that video. Choose another clip.'); }} />}
      <label className="block">Caption <span className="text-sm">(optional)</span>
        <textarea disabled={busy} className="mt-2 block w-full rounded-xl border bg-transparent p-3" rows={3} value={caption} onChange={e => setCaption(e.target.value)} />
      </label>
      {bytes > MAX_CAST_BYTES && <p>Shorten your caption to {MAX_CAST_BYTES} bytes or fewer.</p>}
      {hasActiveSigner ? <button className={button + ' disabled:opacity-45'} disabled={!ready || busy || bytes > MAX_CAST_BYTES} onClick={post}>Post clip</button>
        : <button className={button} onClick={requestSigner}>Enable posting</button>}
      <p role="status">{status}</p>
    </>}
  </main>;
}
