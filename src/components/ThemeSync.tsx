'use client';

import { useEffect } from 'react';

export default function ThemeSync() {
  useEffect(() => {
    try {
      const t = localStorage.getItem('hh_theme');
      if (t && t !== 'default') {
        document.documentElement.setAttribute('data-theme', t);
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    } catch {}
  }, []);

  return null;
}
