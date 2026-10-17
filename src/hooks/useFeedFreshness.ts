'use client';

import { useEffect, useRef, useState } from 'react';
import { unseenCastCount } from '@/lib/feed-policy';

/** Check for updates without replacing loaded pages or moving the reader. */
export function useFeedFreshness(url: string, items: Array<{ hash?: string; id?: string }> | null) {
  const current = useRef(items);
  current.current = items;
  const [updates, setUpdates] = useState(0);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  useEffect(() => {
    setUpdates(0);
  }, [items?.[0]?.hash]);
  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;
    let lastCheck = Date.now();
    setUpdates(0);
    setCheckError(null);
    const check = async () => {
      if (document.visibilityState !== 'visible' || current.current === null || controller || Date.now() - lastCheck < 30_000) return;
      lastCheck = Date.now();
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 12_000);
      try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`Feed check failed (${response.status})`);
        const data = await response.json();
        if (!Array.isArray(data.data)) throw new Error('Node returned an invalid feed');
        if (!disposed) {
          setUpdates(unseenCastCount(current.current || [], data.data));
          setCheckedAt(Date.now());
          setCheckError(null);
        }
      } catch {
        if (!disposed) setCheckError('Could not check for new casts. Try Refresh.');
      } finally {
        window.clearTimeout(timeout);
        controller = null;
      }
    };
    const timer = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
      controller?.abort();
    };
  }, [url]);
  return { updates, checkedAt, checkError };
}
