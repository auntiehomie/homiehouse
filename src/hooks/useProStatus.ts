'use client';

import { useCallback, useEffect, useState } from 'react';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { fetchProStatus } from '@/lib/pro-client';

export function useProStatus() {
  const { fid, isAuthenticated } = useFarcasterAuth();
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    window.addEventListener('focus', refresh);
    window.addEventListener('hh:pro-updated', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('hh:pro-updated', refresh);
    };
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    setIsPro(false);
    setError(null);
    if (!fid || !isAuthenticated) {
      setLoading(false);
      if (fid) setError('Sign in again to check your Pro access. You do not need to pay again.');
      return () => controller.abort();
    }
    setLoading(true);
    const checkoutReturn = window.location.pathname === '/pro'
      && new URLSearchParams(window.location.search).get('status') === 'success';
    const check = async () => {
      try {
        const active = await fetchProStatus(fid, controller.signal);
        if (controller.signal.aborted) return;
        setIsPro(active);
        if (!active && checkoutReturn) {
          setError('Your Pro access is still updating. Refresh access if needed; you do not need to pay again.');
          if (++attempts < 6) timer = setTimeout(check, 3000);
        } else setError(null);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to check Pro access.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void check();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [fid, isAuthenticated, revision]);

  return { isPro, loading, error, refresh };
}
