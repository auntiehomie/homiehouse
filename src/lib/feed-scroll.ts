import type { FeedReturn } from './feed-session';

/** overflow-x:hidden can make body or a layout wrapper the iOS scroll host. */
export function feedScrollHost(node: HTMLElement): HTMLElement {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return (document.scrollingElement || document.documentElement) as HTMLElement;
}

/** Follow the cast anchor through late embed layout, until input or timeout. */
export type FeedPosition = Pick<FeedReturn, 'castHash' | 'castOffset' | 'scrollY'>;

export function restoreFeedScroll(container: HTMLElement, saved: FeedPosition, onRestored: () => void): () => void {
  let stopped = false;
  let frame = 0;
  let restored = false;
  const host = feedScrollHost(container);
  const findAnchor = () => Array.from(container.querySelectorAll<HTMLElement>('[data-feed-cast-hash]'))
    .find(node => node.dataset.feedCastHash === saved.castHash);
  const align = () => {
    frame = 0;
    if (stopped) return;
    const anchor = findAnchor();
    const top = anchor && saved.castOffset !== null
      ? host.scrollTop + anchor.getBoundingClientRect().top - saved.castOffset
      : saved.scrollY;
    host.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    const aligned = anchor && saved.castOffset !== null
      ? Math.abs(anchor.getBoundingClientRect().top - saved.castOffset) < 3
      : Math.abs(host.scrollTop - saved.scrollY) < 3;
    if (aligned && !restored) { restored = true; onRestored(); }
  };
  const schedule = () => { if (!stopped && !frame) frame = requestAnimationFrame(align); };
  const observer = new ResizeObserver(schedule);
  observer.observe(container);
  // Observe the scroll host too: installed-PWA chrome can change available height.
  if (host !== container) observer.observe(host);
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    clearTimeout(timer);
    window.removeEventListener('touchstart', onInput, true);
    window.removeEventListener('wheel', onInput, true);
    window.removeEventListener('keydown', onInput, true);
  };
  const onInput = () => { if (!restored) onRestored(); stop(); };
  const timer = setTimeout(stop, 8000);
  window.addEventListener('touchstart', onInput, { capture: true, passive: true });
  window.addEventListener('wheel', onInput, { capture: true, passive: true });
  window.addEventListener('keydown', onInput, true);
  // Initial layout, then follow only actual size changes rather than fighting scrolling.
  schedule();
  return stop;
}
