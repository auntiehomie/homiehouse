"use client";

import React, { useEffect, useState } from 'react';
import { openMiniApp } from '@/lib/farcaster';

// Sites that set X-Frame-Options: DENY or CSP frame-ancestors: none.
// Opening these in our iframe just shows a blank page, so send to a browser tab instead.
const BLOCKED = new Set([
  'x.com', 'twitter.com',
  'youtube.com', 'youtu.be',
  'instagram.com',
  'facebook.com', 'fb.com',
  'linkedin.com',
  'tiktok.com',
  'reddit.com',
  'netflix.com',
  'spotify.com',
  'google.com',
  'apple.com',
  'amazon.com',
  'github.com',
]);

function isBlocked(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    return BLOCKED.has(h) || [...BLOCKED].some(d => h.endsWith('.' + d));
  } catch { return false; }
}

function openUrl(url: string, title?: string) {
  if (isBlocked(url)) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    openMiniApp(url, title);
  }
}

interface PreviewData {
  ok?: boolean;
  metadata?: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    siteName?: string;
  };
}

export default function UrlPreview({ url, label }: { url: string; label?: string }) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) return;
    const key = `urlPreview:${url}`;
    const cached = sessionStorage.getItem(key);
    if (cached) {
      try { setPreview(JSON.parse(cached)); return; } catch {}
    }

    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch('/api/url-preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        setPreview(data);
        try { sessionStorage.setItem(key, JSON.stringify(data)); } catch {}
      } catch {}
      finally { if (mounted) setLoading(false); }
    })();

    return () => { mounted = false; };
  }, [url]);

  const m = preview?.metadata || {};
  const hasRich = preview?.ok && (m.title || m.image);
  const displayUrl = m.url || url;
  let hostname = '';
  try { hostname = new URL(displayUrl).hostname; } catch {}
  const btnLabel = label || 'Open';

  if (loading) {
    return (
      <div style={{
        borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
        background: '#111', overflow: 'hidden', fontSize: 13, color: '#555',
        padding: '12px 14px',
      }}>
        Loading preview…
      </div>
    );
  }

  if (!hasRich) {
    // Plain link fallback with Open button
    return (
      <div style={{
        borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
        background: '#111', overflow: 'hidden', display: 'flex',
        alignItems: 'center', gap: 10, padding: '10px 12px',
      }}>
        <span style={{ flex: 1, fontSize: 13, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {hostname || displayUrl}
        </span>
        <button
          onClick={e => { e.stopPropagation(); openUrl(displayUrl, m.title); }}
          style={{
            flexShrink: 0, padding: '6px 14px', borderRadius: 20,
            background: '#1e293b', color: '#e2e8f0', fontSize: 13,
            fontWeight: 600, border: '1px solid #334155', cursor: 'pointer',
          }}
        >
          {btnLabel}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
      background: '#111', overflow: 'hidden',
    }}>
      {m.image && (
        <div style={{ width: '100%', maxHeight: 200, overflow: 'hidden', background: '#1a1a1a' }}>
          <img
            src={m.image}
            alt={m.title || hostname}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
          />
        </div>
      )}
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {m.title && (
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
              {m.title}
            </div>
          )}
          {m.description && (
            <div style={{ fontSize: 12, color: '#888', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden', marginBottom: 4 }}>
              {m.description}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#555' }}>{m.siteName || hostname}</div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); openUrl(displayUrl, m.title); }}
          style={{
            flexShrink: 0, padding: '7px 14px', borderRadius: 20,
            background: '#1e293b', color: '#e2e8f0', fontSize: 13,
            fontWeight: 600, border: '1px solid #334155', cursor: 'pointer',
            alignSelf: 'center',
          }}
        >
          {btnLabel}
        </button>
      </div>
    </div>
  );
}
