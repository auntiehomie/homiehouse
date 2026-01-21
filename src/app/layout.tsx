import type { Metadata } from "next";
import "./globals.css";
import SdkDevMock from "../components/SdkDevMock";
import WalletProvider from "../components/WalletProvider";
import BottomNav from "../components/BottomNav";

export const metadata: Metadata = {
  title: "HomieHouse - Your Social Hub",
  description: "Your place to share what's on your mind",
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
        <WalletProvider>
          <SdkDevMock />
          <div className="pb-20">
            {children}
          </div>
          <BottomNav />
        </WalletProvider>
      </body>
    </html>
  );
}
