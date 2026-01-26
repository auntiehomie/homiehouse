import type { Metadata, Viewport } from "next";
import "./globals.css";
import SdkDevMock from "../components/SdkDevMock";
import WalletProvider from "../components/WalletProvider";
import NeynarAuthProvider from "../components/NeynarAuthProvider";
import NeynarProvider from "../components/NeynarProvider";
import BottomNav from "../components/BottomNav";

export const metadata: Metadata = {
  title: "HomieHouse - Your Social Hub",
  description: "Your place to share what's on your mind",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        <NeynarProvider>
          <NeynarAuthProvider>
            <WalletProvider>
              <SdkDevMock />
              <div className="pb-16 sm:pb-20">
                {children}
              </div>
              <BottomNav />
            </WalletProvider>
          </NeynarAuthProvider>
        </NeynarProvider>
      </body>
    </html>
  );
}
