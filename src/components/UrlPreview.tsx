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
        const parsed = JSON.parse(cached);
        setPreview(parsed);
        return;
      } catch (e) {
        console.warn('[UrlPreview] Failed to parse cached preview:', e);
      }
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch('/api/url-preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url })
        });

        if (!res.ok) {
          console.warn(`[UrlPreview] API returned ${res.status}`);
          setError(`HTTP ${res.status}`);
          setLoading(false);
          return;
        }

        const data = await res.json();
        if (!mounted) return;
        
        console.log('[UrlPreview] Received preview:', { url, ok: data.ok, hasImage: !!data.metadata?.image });
        setPreview(data);
        try { sessionStorage.setItem(key, JSON.stringify(data)); } catch {}
      } catch (err) {
        if (!mounted) return;
        console.error('[UrlPreview] Fetch error:', err);
        setError(String(err));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [url]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-gray-200 dark:border-zinc-800 text-sm text-gray-600 dark:text-gray-400">
        Loading preview…
      </div>
    );
  }

  // If preview fetch failed or wasn't ok, show fallback
  if (!preview?.ok) {
    console.log('[UrlPreview] Preview not ok, showing fallback:', { url, preview });
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="block p-3 rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-500 hover:bg-gray-50 dark:hover:bg-zinc-800"
      >
        🔗 {url.length > 80 ? url.substring(0, 80) + '…' : url}
      </a>
    );
  }

  const m = preview.metadata || {};
  if (!m.title && !m.image && !m.description) {
    // No useful metadata — show fallback
    console.log('[UrlPreview] No useful metadata, showing fallback:', { url });
    return (
      <a 
        href={m.url || url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="block p-3 rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-500 hover:bg-gray-50 dark:hover:bg-zinc-800"
      >
        🔗 {(m.url || url).length > 80 ? (m.url || url).substring(0, 80) + '…' : (m.url || url)}
      </a>
    );
  }

  console.log('[UrlPreview] Rendering rich preview:', { url, title: m.title, hasImage: !!m.image });
  return (
    <a 
      href={m.url || url} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="block rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900 hover:shadow-md transition-shadow"
    >
      {m.image && (
        <div className="max-h-48 overflow-hidden bg-gray-100 dark:bg-zinc-800">
          <img 
            src={m.image} 
            alt={m.title || m.siteName || url} 
            className="w-full h-auto object-cover"
            onError={(e) => {
              console.warn('[UrlPreview] Image failed to load:', m.image);
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
      <div className="p-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">
          {m.title || m.siteName || 'Link'}
        </div>
        {m.description && (
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
            {m.description}
          </div>
        )}
        <div className="text-xs text-gray-500 dark:text-gray-500 mt-2 truncate">
          {m.siteName || new URL(m.url || url).hostname}
        </div>
      </div>
    </a>
  );
}
