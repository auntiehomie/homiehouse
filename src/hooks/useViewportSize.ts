'use client';

import { useState, useEffect } from 'react';

/**
 * useViewportSize — detects actual device viewport dimensions.
 *
 * Uses window.visualViewport when available (handles iOS dynamic toolbars,
 * PWA standalone mode, and keyboard appearance). Falls back to
 * window.innerWidth/innerHeight.
 *
 * Returns { width, height, dpr } where height is the actual visible
 * viewport height (not the legacy 100vh which includes browser chrome).
 */
export function useViewportSize() {
  const [size, setSize] = useState({
    width: 0,
    height: 0,
    dpr: 1,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const measure = () => {
      const vv = window.visualViewport;
      setSize({
        width: vv?.width ?? window.innerWidth,
        height: vv?.height ?? window.innerHeight,
        dpr: window.devicePixelRatio || 1,
      });
    };

    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', measure);
    window.addEventListener('orientationchange', () => setTimeout(measure, 100));

    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('scroll', measure);
    };
  }, []);

  return size;
}
