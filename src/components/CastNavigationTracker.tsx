'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { feedDestination, pageScrollY, readCastNavigation, visitRoute, writeCastNavigation } from '@/lib/cast-navigation';
import { readFeedReturn } from '@/lib/feed-session';

export default function CastNavigationTracker() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const path = window.location.pathname + window.location.search;
    // Next/browser scroll resets must not replace the saved return position.
    let suppressUntil = Date.now() + 1500;
    const onUserInput = () => { suppressUntil = 0; };
    writeCastNavigation(visitRoute(readCastNavigation(), path));
    let frame = 0;
    const saveScroll = (force = false) => {
      if (!force && Date.now() < suppressUntil) return;
      const current = window.location.pathname + window.location.search;
      if (current !== path && !force) return;
      if (current.startsWith('/cast/') && !document.querySelector('[data-cast-detail-ready]')) return;
      const state = force ? visitRoute(readCastNavigation(), current) : readCastNavigation();
      const entry = state.entries[state.index];
      if (entry?.path !== current) return;
      entry.scrollY = pageScrollY();
      writeCastNavigation(state);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; saveScroll(); });
    };
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      saveScroll(true);
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[data-feed-navigation]') : null;
      if (!link || link.target === '_blank') return;
      const target = feedDestination();
      event.preventDefault();
      // Let drawer click handlers close the menu. Next's Link respects
      // defaultPrevented, so it won't issue a second navigation.
      router.push(target, { scroll: !readFeedReturn() });
    };
    window.addEventListener('touchstart', onUserInput, { passive: true });
    window.addEventListener('wheel', onUserInput, { passive: true });
    window.addEventListener('keydown', onUserInput);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('click', onClick, true);
    const onPageHide = () => saveScroll(true);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('touchstart', onUserInput);
      window.removeEventListener('wheel', onUserInput);
      window.removeEventListener('keydown', onUserInput);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [pathname, router]);

  return null;
}
