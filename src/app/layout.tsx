import type { Metadata, Viewport } from "next";
import "./globals.css";
import PrivyAuthProvider from "../components/PrivyAuthProvider";
import PrivyAuthSync from "../components/PrivyAuthSync";
import BottomNav from "../components/BottomNav";
import ThemeSync from "../components/ThemeSync";
import LazyClientComponents from "../components/LazyClientComponents";
import PageTransition from "../components/PageTransition";
import { Analytics } from '@vercel/analytics/next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

// JSON-LD structured data for SEO
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'HomieHouse',
  url: BASE_URL,
  description: 'A Farcaster social client — browse your feed, compose casts, and explore the decentralized web.',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

export const metadata: Metadata = {
  title: {
    default: 'HomieHouse',
    template: '%s | HomieHouse',
  },
  icons: {
    icon: [
      { url: '/hh-logo.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/hh-logo.svg',
  },
  manifest: '/manifest.json',
  applicationName: 'HomieHouse',
  appleWebApp: {
    capable: true,
    title: 'HomieHouse',
    statusBarStyle: 'black-translucent',
  },
  description: 'HomieHouse — Your Farcaster social hub. Browse feeds, compose casts, get AI-powered insights with Ask Homie, and curate your personal knowledge base on the decentralized web.',
  keywords: [
    'Farcaster', 'social client', 'decentralized social', 'casts', 'web3 social',
    'Ask Homie', 'AI assistant', 'knowledge base', 'crypto social', 'Farcaster client',
    'decentralized web', 'blockchain social', 'HomieHouse'
  ],
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    type: 'website',
    siteName: 'HomieHouse',
    title: 'HomieHouse — Your home on Farcaster',
    description: 'Personalized Web3 learning plans, Farcaster feeds, mini-apps, and AI insights — all in one place.',
    url: BASE_URL,
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'HomieHouse — Learn Web3. Connect with your community.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HomieHouse — Your home on Farcaster',
    description: 'Personalized Web3 learning plans, Farcaster feeds, mini-apps, and AI insights — all in one place.',
    images: ['/api/og'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

// Privy auth context requires a live React tree and can't run in a static
// build worker — force-dynamic prevents Next.js from attempting to
// statically prerender any page through this layout.
export const dynamic = 'force-dynamic';


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: `(function(){try{var t=localStorage.getItem('hh_theme');if(!t||t==='default')return;if(t==='custom'){var c=JSON.parse(localStorage.getItem('hh_custom_theme')||'{}'),s=document.documentElement.style;[['bgDark','--bg-dark'],['surface','--surface'],['textOnDark','--text-on-dark'],['accent','--accent'],['navBg','--nav-bg'],['btnPrimaryBg','--btn-primary-bg'],['btnPrimaryColor','--btn-primary-color']].forEach(function(p){if(c[p[0]])s.setProperty(p[1],c[p[0]]);});}else{document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`}} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* iOS PWA splash screens — required for clean launch experience */}
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-startup-image" href="/splash.png" />
      </head>
      <body className={`antialiased`}>
        <PrivyAuthProvider>
          <PrivyAuthSync />
          <PageTransition>
            <div className="pb-20 lg:pb-0">
              {children}
            </div>
          </PageTransition>
          <BottomNav />
          <ThemeSync />
          <LazyClientComponents />
        </PrivyAuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
