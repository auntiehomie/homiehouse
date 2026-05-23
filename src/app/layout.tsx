import type { Metadata, Viewport } from "next";
import "./globals.css";
import SdkDevMock from "../components/SdkDevMock";
import PrivyAuthProvider from "../components/PrivyAuthProvider";
import PrivyAuthSync from "../components/PrivyAuthSync";
import BottomNav from "../components/BottomNav";

export const metadata: Metadata = {
  title: "HomieHouse - Your Social Hub",
  description: "Your place to share what's on your mind",
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
