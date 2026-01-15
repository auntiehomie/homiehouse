import type { Metadata } from "next";
import "./globals.css";
import SdkDevMock from "../components/SdkDevMock";
import WalletProvider from "../components/WalletProvider";
import PrivyAuthProvider from "../components/PrivyAuthProvider";

export const metadata: Metadata = {
  title: "HomieHouse - Your Social Hub",
  description: "Your place to share what's on your mind",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        <PrivyAuthProvider>
          <WalletProvider>
            <SdkDevMock />
            {children}
          </WalletProvider>
        </PrivyAuthProvider>
      </body>
    </html>
  );
}
