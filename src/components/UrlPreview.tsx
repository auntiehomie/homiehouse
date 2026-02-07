"use client";

import React, { useEffect, useState } from 'react';

interface PreviewData {
  ok?: boolean;
  metadata?: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    siteName?: string;
  };
  articleText?: string | null;
}

export default function UrlPreview({ url }: { url: string }) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;

    const key = `urlPreview:${url}`;
    const cached = sessionStorage.getItem(key);
    if (cached) {
      try {
        setPreview(JSON.parse(cached));
        return;
      } catch {}
    }

    let mounted = true;
    setLoading(true);
    fetch('/api/url-preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url })
    })
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        setPreview(data);
        try { sessionStorage.setItem(key, JSON.stringify(data)); } catch {}
      })
      .catch((err) => {
        if (!mounted) return;
        setError(String(err));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => { mounted = false; };
  }, [url]);

  if (loading) {
    return (
      <div className="bg-surface dark:bg-zinc-900 p-3 rounded-lg border border-border text-sm text-muted">Loading preview…</div>
    );
  }

  if (error || !preview?.ok) {
    // Fallback: show simple link
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-lg border border-border bg-surface dark:bg-zinc-900 text-accent hover:bg-opacity-80">
        🔗 {url.length > 80 ? url.substring(0, 80) + '…' : url}
      </a>
    );
  }

  const m = preview.metadata || {};

  return (
    <a href={m.url || url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-border overflow-hidden bg-surface dark:bg-zinc-900 hover:shadow-md transition-shadow">
      {m.image && (
        <div style={{ maxHeight: 200, overflow: 'hidden' }}>
          <img src={m.image} alt={m.title || m.siteName || url} style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
      )}
      <div style={{ padding: 12 }}>
        <div className="text-sm font-semibold text-gray-900 dark:text-white">{m.title || m.siteName || url}</div>
        {m.description && <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{m.description}</div>}
        <div className="text-xs text-muted mt-2">{m.url || url}</div>
      </div>
    </a>
  );
}
