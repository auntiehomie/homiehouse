import type { Metadata, Viewport } from "next";
import "./globals.css";
import SdkDevMock from "../components/SdkDevMock";
import PrivyAuthProvider from "../components/PrivyAuthProvider";
import PrivyAuthSync from "../components/PrivyAuthSync";
import BottomNav from "../components/BottomNav";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.xyz';

export const metadata: Metadata = {
  title: {
    default: 'HomieHouse',
    template: '%s | HomieHouse',
  },
  description: 'A Farcaster social client — browse your feed, compose casts, and explore the decentralized web.',
  metadataBase: new URL(BASE_URL),
  openGraph: {
    type: 'website',
    siteName: 'HomieHouse',
    title: 'HomieHouse — Farcaster Social Client',
    description: 'Browse your Farcaster feed, compose casts, explore channels, and connect with the decentralized social web.',
    url: BASE_URL,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'HomieHouse — Farcaster Social Client',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HomieHouse — Farcaster Social Client',
    description: 'Browse your Farcaster feed, compose casts, explore channels, and connect with the decentralized social web.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
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
    <html lang="en">
      <body className={`antialiased`}>
        <PrivyAuthProvider>
          <PrivyAuthSync />
          <SdkDevMock />
          <div className="pb-20 md:pb-8">
            {children}
          </div>
          <BottomNav />
        </PrivyAuthProvider>
      </body>
    </html>
  );
}
