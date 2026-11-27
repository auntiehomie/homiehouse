'use client';

import { useState, useEffect, useRef } from 'react';
import SnapRenderer, { type SnapData, type SnapAction } from './SnapRenderer';
import FrameEmbed from './FrameEmbed';
import UrlPreview from './UrlPreview';
import { openMiniApp } from '@/lib/farcaster';
import { buildJfs, getSignerForFid } from '@/lib/snap-jfs';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { useRouter } from 'next/navigation';
import { openComposeModal } from '@/lib/compose-modal-events';
import { profileHref } from '@/lib/profile-links';
import { LEARN_QUIZ_LESSON_ID } from '@/lib/learn-quiz';

type Result = 'frame' | 'snap' | 'url';

interface Props {
  url: string;
  castHash?: string;
}

/**
 * Probes a URL for Frame v1 and Snap content in parallel.
 * Shows UrlPreview immediately; upgrades to Frame or Snap when confirmed.
 */
export default function SmartEmbed({ url, castHash }: Props) {
  const [result, setResult] = useState<Result>('url');
  const [snap, setSnap] = useState<SnapData | null>(null);
  const wonRef = useRef(false);
  const [snapUrl, setSnapUrl] = useState(url);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { fid: rawFid } = useFarcasterAuth();
  const router = useRouter();
  const fid: number = rawFid ?? 0;

  useEffect(() => {
    setResult('url');
    setSnap(null);
    setSnapUrl(url);
    setError(null);
    wonRef.current = false;

    let alive = true;
    const TIMEOUT = 5000;

    const probeFrame = fetch(`/api/frame?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(TIMEOUT) })
      .then(r => r.json())
      .catch(() => ({ isFrame: false }));

    const probeSnap = fetch(`/api/snap?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(TIMEOUT) })
      .then(r => r.json())
      .catch(() => ({ isSnap: false }));

    // Frame wins if found — check first
    probeFrame.then(data => {
      if (!alive || wonRef.current) return;
      if (data.isFrame) {
        wonRef.current = true;
        setResult('frame');
      }
    });

    // Snap wins only if no frame
    probeSnap.then(data => {
      if (!alive || wonRef.current) return;
      if (data.isSnap && data.snap) {
        wonRef.current = true;
        setSnap(data.snap);
        setResult('snap');
      }
    });

    return () => { alive = false; };
  }, [url]);

  const handleSnapAction = async (action: SnapAction, inputs: Record<string, unknown>) => {
    switch (action.action) {
      case 'open_url': {
        const target = action.params?.target;
        if (target === `${window.location.origin}/learn/library/${LEARN_QUIZ_LESSON_ID}`) {
          router.push(`/learn/library/${LEARN_QUIZ_LESSON_ID}`);
        } else if (typeof target === 'string') {
          openMiniApp(target);
        }
        return;
      }
      case 'view_cast':
        if (action.params?.hash) router.push(`/cast/${action.params.hash}`);
        return;
      case 'view_profile':
        router.push(profileHref({
          username: typeof action.params?.username === 'string' ? action.params.username : null,
          fid: typeof action.params?.fid === 'number' || typeof action.params?.fid === 'string'
            ? action.params.fid
            : null,
        }));
        return;
      case 'compose_cast':
        openComposeModal({ text: action.params?.text ?? '' });
        return;
      case 'open_snap': {
        const newUrl = action.params?.target ?? action.params?.url;
        if (typeof newUrl !== 'string' || !newUrl) return;
        setError(null);
        setSubmitting(true);
        try {
          const data = await fetch(`/api/snap?url=${encodeURIComponent(newUrl)}`).then(r => r.json());
          if (!data.isSnap || !data.snap) throw new Error('Snap unavailable');
          setSnap(data.snap);
          setSnapUrl(newUrl);
        } catch {
          setError('Could not open this Snap. Try again.');
        } finally {
          setSubmitting(false);
        }
        return;
      }
      case 'submit': {
        if (!fid) { setError('Sign in to interact'); return; }
        const signer = getSignerForFid(fid);
        if (!signer) { setError('Enable a Hypersnap signer in HomieHouse first'); return; }
        setSubmitting(true);
        setError(null);
        try {
          const jfsToken = buildJfs({ fid, privateKeyHex: signer.privateKeyHex, inputs, snapUrl, surface: castHash ? 'cast' : 'standalone' });
          const res = await fetch('/api/snap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: snapUrl, jfsToken }) });
          if (!res.ok) throw new Error(`Error ${res.status}`);
          setSnap(await res.json());
        } catch (e: any) {
          setError(e.message);
        }
        setSubmitting(false);
        return;
      }
    }
  };

  if (result === 'frame') return <FrameEmbed url={url} castHash={castHash} />;
  if (result === 'snap' && snap) return (
    <div>
      <SnapRenderer snap={snap} onAction={handleSnapAction} submitting={submitting} />
      {error && <p className="text-xs text-red-400 mt-1 px-1">{error}</p>}
    </div>
  );

  // Default: UrlPreview (shows immediately, stays if neither frame nor snap)
  return <UrlPreview url={url} label="Open" />;
}
