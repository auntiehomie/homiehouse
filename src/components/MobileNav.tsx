'use client';

import GettingStartedButton from './GettingStartedButton';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useFarcasterUser } from '@/hooks/useFarcasterUser';
import { ChannelSidebar } from './ChannelStrip';
import NotificationBadge from './NotificationBadge';
import HHLogo from './HHLogo';
import ProfileSummary from './ProfileSummary';
import AppIcon from './AppIcon';

// ── Icons ──────────────────────────────────────────────────────────────────────

const FeedIcon = <AppIcon name="feed" className="w-5 h-5" />;
const LearnIcon = <AppIcon name="learn" className="w-5 h-5" />;
const AppsIcon = <AppIcon name="apps" className="w-5 h-5" />;
const CastIcon = <AppIcon name="cast" className="w-5 h-5" />;

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
  { href: '/feed', label: 'Feed', exact: true, icon: FeedIcon },
  { href: '/messages', label: 'Messages', icon: <AppIcon name="messages" className="w-5 h-5" /> },
  { href: '/learn', label: 'Learn', icon: LearnIcon },
  { href: '/apps', label: 'Apps', icon: AppsIcon },
  { href: '/community', label: 'Community', icon: <AppIcon name="community" className="w-5 h-5" /> },
  { href: '/hh2', label: 'HH2 Token', icon: <AppIcon name="token" className="w-5 h-5" /> },
  { href: '/wallet', label: 'Wallet', icon: <AppIcon name="wallet" className="w-5 h-5" /> },
  { href: '/notes', label: 'Knowledge', icon: <AppIcon name="knowledge" className="w-5 h-5" /> },
  { href: '/compose', label: 'Cast', icon: CastIcon },
  { href: '/notifications', label: 'Alerts', icon: <NotificationBadge className="w-5 h-5" /> },
  { href: '/ask-homie', label: 'Ask Homie', icon: <AppIcon name="ask" className="w-5 h-5" /> },
  { href: '/shop', label: 'Shop', icon: <AppIcon name="shop" className="w-5 h-5" /> },
  { href: '/pfp-studio', label: 'Studio', icon: <AppIcon name="studio" className="w-5 h-5" /> },
  { href: '/pro', label: 'Pro', icon: <AppIcon name="pro" className="w-5 h-5" /> },
  { href: '/settings', label: 'Settings', icon: <AppIcon name="settings" className="w-5 h-5" /> },
];

// ── Quick-access items (top bar) ───────────────────────────────────────────────

const QUICK_ITEMS = [
  { href: '/feed', label: 'Feed', exact: true, icon: FeedIcon },
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
      {/* ── Bottom quick nav (mobile only) ───────────────────────────────────── */}
      <nav
        className="lg:hidden hh-bottom-nav hh-mobile-nav"
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex: 9500,
          background: 'var(--nav-bg)',
          borderTop: '1px solid var(--nav-border)',
          // Extend the background below the controls into the iOS home-indicator area.
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
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
         height: 56,
         display: 'flex',
         alignItems: 'center',
         justifyContent: 'space-between',
         gap: 8,
          // Safe-area padding is already on the parent <nav>.
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
              // Returning from cast detail uses FeedList's saved anchor, so
              // don't let Next's default top-scroll override that restoration.
              return (
                <Link
                  key={item.href}
                  data-feed-navigation={item.href === '/feed' ? 'true' : undefined}
                  href={item.href}
                  scroll={item.href === '/feed' && pathname.startsWith('/cast/') ? false : undefined}
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
              paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
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

            <div style={{ padding: '0 12px' }}>
              <ProfileSummary />
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
                  data-feed-navigation={item.href === '/feed' ? 'true' : undefined}
                      href={href}
                      onClick={() => setDrawerOpen(false)}
                      scroll={item.href === '/feed' && pathname.startsWith('/cast/') ? false : undefined}
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

              <GettingStartedButton onOpen={() => setDrawerOpen(false)} />

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
