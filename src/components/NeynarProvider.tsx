'use client';

import { NeynarContextProvider, Theme } from "@neynar/react";
import "@neynar/react/dist/style.css";

export default function NeynarProvider({ children }: { children: React.ReactNode }) {
  return (
    <NeynarContextProvider
      settings={{
        clientId: process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID || "",
        defaultTheme: Theme.Dark,
      }}
    >
      {children}
    </NeynarContextProvider>
  );
}
