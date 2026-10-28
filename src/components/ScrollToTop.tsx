'use client';

import { useState, useEffect } from 'react';

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setVisible(window.scrollY > 400);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
      className="lg:hidden"
      style={{
        position: 'fixed',
        bottom: 'max(calc(env(safe-area-inset-bottom) + 72px), 88px)',
        right: 16,
        zIndex: 9400,
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text-on-dark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.3)',
        transition: 'transform 0.15s, opacity 0.15s',
        animation: 'hhFadeIn 0.2s ease-out',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
      onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.92)'}
      onTouchEnd={(e) => { e.currentTarget.style.transform = ''; }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  );
}