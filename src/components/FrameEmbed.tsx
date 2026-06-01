'use client';

import { useState, useEffect } from 'react';
import type { FrameData } from '@/app/api/frame/route';

interface Props {
  url: string;
  castHash?: string;
}

export default function FrameEmbed({ url, castHash }: Props) {
  const [frame, setFrame] = useState<FrameData | null>(null);
  const [probing, setProbing] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [interactError, setInteractError] = useState<string | null>(null);

  useEffect(() => {
    setProbing(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    fetch(`/api/frame?url=${encodeURIComponent(url)}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data.isFrame && data.frame) setFrame(data.frame);
      })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); setProbing(false); });

    return () => { controller.abort(); clearTimeout(timer); };
  }, [url]);

  const handleButton = async (btn: FrameData['buttons'][0]) => {
    if (btn.action === 'link') {
      window.open(btn.target || url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (btn.action === 'post_redirect' || btn.action === 'post') {
      const postUrl = btn.target || frame?.postUrl || url;
      setLoading(true);
      setInteractError(null);
      try {
        const res = await fetch('/api/frame/interact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, postUrl, buttonIndex: btn.index, inputText: inputValue, castHash }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setInteractError(data.error || `Error ${res.status}`);
        } else if (data.isFrame && data.frame) {
          setFrame(data.frame);
        }
      } catch (e: any) {
        setInteractError(e.message || 'Action failed');
      }
      setLoading(false);
    }
  };

  // Still probing — don't flash anything
  if (probing) return null;

  // Not a frame — caller should fall through
  if (!frame) return null;

  const actionLabel: Record<string, string> = {
    link: '↗',
    post: '',
    post_redirect: '',
    mint: '⬡',
  };

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900">
      {/* Frame image */}
      {frame.image && (
        <div className="w-full aspect-[1.91/1] bg-zinc-800 overflow-hidden">
          <img
            src={frame.image}
            alt="Frame"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Optional text input */}
      {frame.inputText && (
        <div className="px-3 pt-3">
          <input
            type="text"
            placeholder={frame.inputText}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            className="w-full bg-zinc-800 text-zinc-100 text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
        </div>
      )}

      {/* Buttons */}
      {frame.buttons.length > 0 && (
        <div className={`grid gap-2 p-3 ${frame.buttons.length === 1 ? 'grid-cols-1' : frame.buttons.length === 2 ? 'grid-cols-2' : frame.buttons.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {frame.buttons.map(btn => (
            <button
              key={btn.index}
              onClick={() => handleButton(btn)}
              disabled={loading}
              className="flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium bg-zinc-800 text-zinc-200 rounded-lg border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-500 transition-colors disabled:opacity-40 truncate"
            >
              <span className="truncate">{btn.label}</span>
              {actionLabel[btn.action] && (
                <span className="shrink-0 text-zinc-400">{actionLabel[btn.action]}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {interactError && (
        <div className="px-3 pb-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-red-400">{interactError}</span>
          <span className="text-xs text-zinc-600">—</span>
          <a
            href={`https://warpcast.com`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-400 hover:text-white underline"
          >
            Open in Warpcast to interact
          </a>
        </div>
      )}
    </div>
  );
}
