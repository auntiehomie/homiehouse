'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import SnapRenderer, { type SnapData, type SnapAction } from './SnapRenderer';
import UrlPreview from './UrlPreview';
import { buildJfs, getSignerForFid } from '@/lib/snap-jfs';

interface SnapEmbedProps {
  url: string;
  castHash?: string;
}

export default function SnapEmbed({ url, castHash }: SnapEmbedProps) {
  const [snap, setSnap] = useState<SnapData | null>(null);
  const [snapUrl, setSnapUrl] = useState(url);
  const [probing, setProbing] = useState(true);
  const [isSnap, setIsSnap] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = usePrivy();
  const router = useRouter();

  const farcasterAccount = (user?.linkedAccounts ?? []).find((a: any) => a.type === 'farcaster') as any;
  const fid: number = farcasterAccount?.fid ?? 0;

  // Probe the URL for snap content
  useEffect(() => {
    setProbing(true);
    setIsSnap(false);
    setSnap(null);
    setError(null);

    fetch(`/api/snap?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(data => {
        if (data.isSnap && data.snap) {
          setSnap(data.snap);
          setIsSnap(true);
        }
      })
      .catch(() => {/* fall through to UrlPreview */})
      .finally(() => setProbing(false));
  }, [url]);

  const handleAction = useCallback(async (action: SnapAction, inputs: Record<string, unknown>) => {
    switch (action.action) {
      case 'open_url': {
        const target = action.params?.target;
        if (target) window.open(target, '_blank', 'noopener,noreferrer');
        return;
      }

      case 'view_cast': {
        const hash = action.params?.hash;
        if (hash) router.push(`/cast/${hash}`);
        return;
      }

      case 'view_profile': {
        const username = action.params?.username || action.params?.fid;
        if (username) router.push(`/profile?user=${username}`);
        return;
      }

      case 'compose_cast': {
        const text = action.params?.text ?? '';
        window.dispatchEvent(new CustomEvent('hh:compose', { detail: { text } }));
        return;
      }

      case 'open_snap': {
        const newUrl = action.params?.url;
        if (!newUrl) return;
        setSubmitting(true);
        setError(null);
        try {
          const data = await fetch(`/api/snap?url=${encodeURIComponent(newUrl)}`).then(r => r.json());
          if (data.isSnap && data.snap) {
            setSnap(data.snap);
            setSnapUrl(newUrl);
          }
        } catch {
          setError('Failed to load snap');
        } finally {
          setSubmitting(false);
        }
        return;
      }

      case 'submit': {
        if (!fid) {
          setError('Sign in to interact with snaps');
          return;
        }
        const signer = getSignerForFid(fid);
        if (!signer) {
          setError('Approve your Farcaster signer to interact');
          return;
        }

        setSubmitting(true);
        setError(null);
        try {
          const jfsToken = buildJfs({
            fid,
            privateKeyHex: signer.privateKeyHex,
            inputs,
            snapUrl,
            surface: castHash ? 'cast' : 'standalone',
          });

          const res = await fetch('/api/snap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: snapUrl, jfsToken }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Error ${res.status}`);
          }

          const nextSnap: SnapData = await res.json();
          setSnap(nextSnap);
        } catch (e: any) {
          setError(e.message || 'Action failed');
        } finally {
          setSubmitting(false);
        }
        return;
      }

      default:
        console.log('[SnapEmbed] Unhandled action:', action.action);
    }
  }, [fid, snapUrl, castHash, router]);

  // Still probing — show a minimal skeleton
  if (probing) {
    return <div className="h-24 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />;
  }

  // Not a snap — fall through to regular URL preview
  if (!isSnap || !snap) {
    return <UrlPreview url={url} />;
  }

  return (
    <div>
      <SnapRenderer snap={snap} onAction={handleAction} submitting={submitting} />
      {error && (
        <p className="text-xs text-red-400 mt-1 px-1">{error}</p>
      )}
    </div>
  );
}
