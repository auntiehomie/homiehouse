'use client';

import { useEffect } from 'react';

export function applyCustomThemeVars(colors: Record<string, string>) {
  const s = document.documentElement.style;
  if (colors.bgDark) { s.setProperty('--bg-dark', colors.bgDark); s.setProperty('--background', colors.bgDark); }
  if (colors.surface) s.setProperty('--surface', colors.surface);
  if (colors.textOnDark) { s.setProperty('--text-on-dark', colors.textOnDark); s.setProperty('--foreground', colors.textOnDark); }
  if (colors.mutedOnDark) s.setProperty('--muted-on-dark', colors.mutedOnDark);
  if (colors.border) { s.setProperty('--border', colors.border); s.setProperty('--nav-border', colors.border); }
  if (colors.accent) { s.setProperty('--accent', colors.accent); s.setProperty('--accent-hover', colors.accent); s.setProperty('--accent-soft', colors.accent + '4d'); }
  if (colors.navBg) s.setProperty('--nav-bg', colors.navBg);
  if (colors.btnPrimaryBg) s.setProperty('--btn-primary-bg', colors.btnPrimaryBg);
  if (colors.btnPrimaryColor) s.setProperty('--btn-primary-color', colors.btnPrimaryColor);
}

export function clearCustomThemeVars() {
  const s = document.documentElement.style;
  ['--bg-dark','--surface','--text-on-dark','--muted-on-dark','--border','--accent','--accent-hover','--accent-soft','--nav-bg','--nav-border','--btn-primary-bg','--btn-primary-color','--background','--foreground'].forEach(v => s.removeProperty(v));
}

export default function ThemeSync() {
  useEffect(() => {
    try {
      const t = localStorage.getItem('hh_theme');
      if (!t || t === 'default') {
        document.documentElement.removeAttribute('data-theme');
        clearCustomThemeVars();
      } else if (t === 'custom') {
        document.documentElement.removeAttribute('data-theme');
        const raw = localStorage.getItem('hh_custom_theme');
        if (raw) applyCustomThemeVars(JSON.parse(raw));
      } else {
        clearCustomThemeVars();
        document.documentElement.setAttribute('data-theme', t);
      }
    } catch {}
  }, []);

  return null;
}
