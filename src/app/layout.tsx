import type { Metadata, Viewport } from "next";
import "./globals.css";
import SdkDevMock from "../components/SdkDevMock";
import PrivyAuthProvider from "../components/PrivyAuthProvider";
import PrivyAuthSync from "../components/PrivyAuthSync";
import SignerInit from "../components/SignerInit";
import BottomNav from "../components/BottomNav";
import WelcomeModal from "../components/WelcomeModal";
import ThemeSync from "../components/ThemeSync";
import PushNotificationSetup from "../components/PushNotificationSetup";

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
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon-32.png',
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
    title: 'HomieHouse',
    description: 'Browse your Farcaster feed, compose casts, explore channels, get AI-powered insights, and connect with the decentralized social web.',
    url: BASE_URL,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'HomieHouse',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HomieHouse',
    description: 'Browse your Farcaster feed, compose casts, explore channels, get AI-powered insights, and connect with the decentralized social web.',
    images: ['/og-image.png'],
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

// Force dynamic rendering since we use client-side auth providers
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: `(function(){try{var t=localStorage.getItem('hh_theme');if(t&&t!=='default')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`}} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`antialiased`}>
        <PrivyAuthProvider>
          <PrivyAuthSync />
          <SignerInit />
          <SdkDevMock />
          <div className="pb-20 md:pb-8">
            {children}
          </div>
          <BottomNav />
          <WelcomeModal />
          <ThemeSync />
          <PushNotificationSetup />
        </PrivyAuthProvider>
      </body>
    </html>
  );
}
