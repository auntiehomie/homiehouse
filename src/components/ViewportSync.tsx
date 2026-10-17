'use client';

import { useEffect } from 'react';

/** Android keyboards and browser chrome can resize the visual viewport only. */
export default function ViewportSync() {
  useEffect(() => {
    const viewport = window.visualViewport;
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--hh-viewport-height', `${viewport?.height || window.innerHeight}px`);
        document.documentElement.style.setProperty('--hh-viewport-top', `${viewport?.offsetTop || 0}px`);
      });
    };
    sync();
    viewport?.addEventListener('resize', sync);
    viewport?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', sync);
      viewport?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);
  return null;
}
