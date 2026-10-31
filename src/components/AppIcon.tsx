import type { ReactNode, SVGProps } from 'react';

export type AppIconName =
  | 'home' | 'feed' | 'messages' | 'learn' | 'apps' | 'community' | 'token'
  | 'wallet' | 'knowledge' | 'cast' | 'notifications' | 'ask' | 'shop'
  | 'studio' | 'pro' | 'settings' | 'refresh' | 'back' | 'heart' | 'recast'
  | 'user' | 'mention' | 'reply' | 'warning' | 'image' | 'close' | 'spinner' | 'quote';

const paths: Record<AppIconName, ReactNode> = {
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  feed: <><rect x="4" y="3" width="14" height="17" rx="2" /><path d="M8 7h6M8 11h6M8 15h4M18 7h2v14H7" /></>,
  messages: <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3.3-.7L4 20l1.7-4.1A7.5 7.5 0 1 1 20 11.5Z" />,
  learn: <><path d="m2.5 9 9.5-5 9.5 5-9.5 5z" /><path d="M6 11v5c3.5 2.7 8.5 2.7 12 0v-5M21.5 9v6" /></>,
  apps: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></>,
  community: <><path d="M12 21s8-4 8-11V5l-8-3-8 3v5c0 7 8 11 8 11Z" /><path d="M9 11h6M12 8v6" /></>,
  token: <><circle cx="12" cy="12" r="9" /><path d="M8 9h8M8 12h8M8 15h8M12 6v12" /></>,
  wallet: <><rect x="3" y="6" width="18" height="15" rx="2" /><path d="M3 9h18M16 14h2M7 6V4a1 1 0 0 1 1-1h10" /></>,
  knowledge: <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z" /><path d="M4 17a2.5 2.5 0 0 1 2.5-2.5H20M8 6h8M8 9h8" /></>,
  cast: <><path d="m14 5 5 5M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z" /><path d="M13 6 18 11" /></>,
  notifications: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  ask: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.6 2.6 0 1 1 4.7 1.5c-.8 1-2.2 1.1-2.2 2.5M12 16.5v.1" /></>,
  shop: <><path d="M4 8h16l1 12H3zM8 8V6a4 4 0 0 1 8 0v2" /></>,
  studio: <><path d="M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 1.5-3.3 1.5 1.5 0 0 1 1.2-2.5H18a3 3 0 0 0 3-3c0-5.1-4-9.2-9-9.2Z" /><path d="M7.5 11h.1M10 7.5h.1M15 7.5h.1" /></>,
  pro: <path d="m13 2-9 12h7l-1 8 10-13h-7z" />,
  settings: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3H3.7a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.4-3" /></>,
  back: <><path d="m14 5-7 7 7 7M7 12h14" /></>,
  heart: <path d="M20.8 8.8c0 5-8.8 11-8.8 11s-8.8-6-8.8-11a4.8 4.8 0 0 1 8.8-2.6 4.8 4.8 0 0 1 8.8 2.6Z" />,
  recast: <><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  mention: <><path d="M16.5 8v5a2.5 2.5 0 0 0 5 0v-1a9.5 9.5 0 1 0-3 7" /><circle cx="12" cy="12" r="3.5" /></>,
  reply: <path d="M9 10 4 15l5 5M4 15h10a6 6 0 0 0 0-12h-2" />,
  warning: <><path d="M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  spinner: <><path d="M20 12a8 8 0 0 1-13.7 5.7" /><path d="M4 12a8 8 0 0 1 13.7-5.7" /><path d="M6 17.7H6v-4M18 6.3V10" /></>,
  quote: <><path d="M10 11H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5c0 3-1 5-4 7M21 11h-5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5c0 3-1 5-4 7" /></>,
};

type Props = SVGProps<SVGSVGElement> & { name: AppIconName };

export default function AppIcon({ name, className, ...props }: Props) {
  return (
    <svg
      aria-hidden="true"
      className={`app-icon${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      fill={name === 'heart' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
