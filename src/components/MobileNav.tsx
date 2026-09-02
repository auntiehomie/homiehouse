'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useFarcasterUser } from '@/hooks/useFarcasterUser';
import { ChannelSidebar } from './ChannelStrip';
import NotificationBadge from './NotificationBadge';
import HHLogo from './HHLogo';

// ── Icons ──────────────────────────────────────────────────────────────────────

const FeedIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6-4h2" />
  </svg>
);

const LearnIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
  </svg>
);

const CastIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const HamburgerIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ── Full nav items (same as SidebarNav) ────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/', label: 'Feed', exact: true, icon: FeedIcon },
  { href: '/learn', label: 'Learn', icon: LearnIcon },
  { href: '/hh2', label: 'HH2 Token', icon: <span style={{ fontSize: 18, lineHeight: 1 }}>🪙</span> },
  {
    href: '/wallet', label: 'Wallet', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    href: '/notes', label: 'Knowledge', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  { href: '/compose', label: 'Cast', icon: CastIcon },
  { href: '/notifications', label: 'Alerts', icon: <NotificationBadge className="w-5 h-5" /> },
  {
    href: '/ask-homie', label: 'Ask Homie', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/shop', label: 'Shop', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
  { href: '/pro', label: 'Pro', icon: <span style={{ fontSize: 16, lineHeight: 1 }}>⚡</span> },
  {
    href: '/settings', label: 'Settings', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

// ── Quick-access items (top bar) ───────────────────────────────────────────────

const QUICK_ITEMS = [
  { href: '/', label: 'Feed', exact: true, icon: FeedIcon },
  { href: '/compose', label: 'Cast', icon: CastIcon },
  { href: '/learn', label: 'Learn', icon: LearnIcon },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function MobileNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isAuthenticated } = useFarcasterUser();
  const [hasLearnPlan, setHasLearnPlan] = useState(true);
  const [profileUser, setProfileUser] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    try { setHasLearnPlan(!!localStorage.getItem('hh_learning_plan')); } catch {}
  }, []);

  useEffect(() => {
    if (pathname === '/profile') {
      const params = new URLSearchParams(window.location.search);
      setProfileUser(params.get('user'));
    } else {
      setProfileUser(null);
    }
  }, [pathname]);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const isActive = useCallback((path: string, exact?: boolean) => {
    if (exact) return pathname === path;
    return pathname === path || pathname.startsWith(path + '/');
  }, [pathname]);

  if (!mounted || !isAuthenticated) return null;

  return (
    <>
      {/* ── Slim top bar (mobile only) ───────────────────────────────────────── */}
      <nav
        className="lg:hidden"
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          zIndex: 9500,
          background: 'var(--nav-bg)',
          borderBottom: '1px solid var(--nav-border)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          // Extend background into the safe area so the notch/status bar region is opaque
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <style>{`
          @keyframes learnPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.6); }
          }
          .learn-pulse-dot { animation: learnPulse 2s ease-in-out infinite; }
          @keyframes drawerIn {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
          }
          .hh-drawer { animation: drawerIn 0.2s ease-out; }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .hh-overlay { animation: fadeIn 0.15s ease-out; }
        `}</style>

        <div style={{
          maxWidth: '100%',
          margin: '0 auto',
          padding: '0 12px',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          // Push nav content below the notch/status bar in PWA standalone mode
          paddingTop: 'env(safe-area-inset-top)',
        }}>
          {/* Left: hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-on-dark)',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            {HamburgerIcon}
          </button>

          {/* Center: quick-access icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center' }}>
            {QUICK_ITEMS.map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    padding: '6px 14px',
                    borderRadius: 10,
                    textDecoration: 'none',
                    color: active ? 'var(--text-on-dark)' : 'var(--muted-on-dark)',
                    fontWeight: active ? 600 : 400,
                    fontSize: 10,
                    transition: 'color 0.15s',
                    position: 'relative',
                  }}
                >
                  <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    {item.icon}
                    {item.href === '/learn' && !hasLearnPlan && !active && (
                      <span
                        className="learn-pulse-dot"
                        style={{
                          position: 'absolute', top: -2, right: -4,
                          width: 6, height: 6, borderRadius: '50%',
                          background: '#34d399',
                        }}
                      />
                    )}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right: logo */}
          <Link
            href="/"
            aria-label="HomieHouse home"
            style={{
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              textDecoration: 'none',
            }}
          >
            <HHLogo size={24} />
          </Link>
        </div>
      </nav>

      {/* ── Slide-out drawer ─────────────────────────────────────────────────── */}
      {drawerOpen && (
        <>
          {/* Overlay */}
          <div
            className="hh-overlay lg:hidden"
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              background: 'rgba(0, 0, 0, 0.5)',
            }}
          />

          {/* Drawer panel */}
          <div
            className="hh-drawer lg:hidden"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: 280,
              maxWidth: '85vw',
              zIndex: 9999,
              background: 'var(--bg-dark)',
              borderRight: '1px solid var(--border)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Drawer header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <HHLogo size={26} />
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-on-dark)' }}>
                  HomieHouse
                </span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted-on-dark)',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {CloseIcon}
              </button>
            </div>

            {/* Drawer body — full nav */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 20 }}>
                {NAV_ITEMS.map((item) => {
                  const active = isActive(item.href, item.exact);
                  // If on /profile and it's the Cast item, show Mention variant
                  const isCast = item.href === '/compose';
                  const href = profileUser && isCast
                    ? `/compose?text=${encodeURIComponent('@' + profileUser + ' ')}`
                    : item.href;
                  const label = profileUser && isCast ? 'Mention' : item.label;
                  return (
                    <Link
                      key={item.href}
                      href={href}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '11px 12px',
                        borderRadius: 10,
                        textDecoration: 'none',
                        fontWeight: active ? 600 : 400,
                        fontSize: 15,
                        color: active ? 'var(--text-on-dark)' : 'var(--muted-on-dark)',
                        background: active ? 'var(--surface)' : 'transparent',
                        transition: 'background 0.15s, color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
                      }}
                      onMouseLeave={(e) => {
                        if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        {item.icon}
                      </span>
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />

              {/* Channels */}
              <ChannelSidebar />
            </div>
          </div>
        </>
      )}
    </>
  );
}
