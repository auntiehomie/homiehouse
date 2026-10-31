'use client';

import GettingStartedButton from './GettingStartedButton';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChannelSidebar } from './ChannelStrip';
import NotificationBadge from './NotificationBadge';
import ProfileSummary from './ProfileSummary';
import AppIcon from './AppIcon';

const NAV_ITEMS = [
  { href: '/', label: 'Home', exact: true, icon: <AppIcon name="home" className="w-5 h-5" /> },
  { href: '/feed', label: 'Feed', icon: <AppIcon name="feed" className="w-5 h-5" /> },
  { href: '/messages', label: 'Messages', exact: true, icon: <AppIcon name="messages" className="w-5 h-5" /> },
  { href: '/learn', label: 'Learn', icon: <AppIcon name="learn" className="w-5 h-5" /> },
  { href: '/apps', label: 'Apps', icon: <AppIcon name="apps" className="w-5 h-5" /> },
  { href: '/community', label: 'Community', icon: <AppIcon name="community" className="w-5 h-5" /> },
  { href: '/hh2', label: 'HH2 Token', icon: <AppIcon name="token" className="w-5 h-5" /> },
  { href: '/wallet', label: 'Wallet', icon: <AppIcon name="wallet" className="w-5 h-5" /> },
  { href: '/notes', label: 'Knowledge', icon: <AppIcon name="knowledge" className="w-5 h-5" /> },
  { href: '/compose', label: 'Cast', icon: <AppIcon name="cast" className="w-5 h-5" /> },
  { href: '/notifications', label: 'Alerts', icon: <NotificationBadge className="w-5 h-5" /> },
  { href: '/ask-homie', label: 'Ask Homie', icon: <AppIcon name="ask" className="w-5 h-5" /> },
  { href: '/shop', label: 'Shop', icon: <AppIcon name="shop" className="w-5 h-5" /> },
  { href: '/pfp-studio', label: 'Studio', icon: <AppIcon name="studio" className="w-5 h-5" /> },
  { href: '/pro', label: 'Pro', icon: <AppIcon name="pro" className="w-5 h-5" /> },
  { href: '/settings', label: 'Settings', icon: <AppIcon name="settings" className="w-5 h-5" /> },
];

export default function SidebarNav() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Nav links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 20 }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
                  data-feed-navigation={item.href === '/feed' ? 'true' : undefined}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '9px 12px',
                borderRadius: 10,
                textDecoration: 'none',
                fontWeight: active ? 600 : 400,
                fontSize: 15,
                color: active ? 'var(--text-on-dark)' : 'var(--muted-on-dark)',
                transition: 'background 0.15s, color 0.15s',
                background: active ? 'var(--surface)' : 'transparent',
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
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <GettingStartedButton />
      <ProfileSummary />

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />

      {/* Channels */}
      <ChannelSidebar />
    </div>
  );
}
