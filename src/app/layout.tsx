import type { Metadata } from "next";
import "./globals.css";
import SdkDevMock from "../components/SdkDevMock";
import AuthKitProviderWrapper from "../components/AuthKitProviderWrapper";

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
        <AuthKitProviderWrapper>
          <SdkDevMock />
          {children}
        </AuthKitProviderWrapper>
      </body>
    </html>
  );
}
