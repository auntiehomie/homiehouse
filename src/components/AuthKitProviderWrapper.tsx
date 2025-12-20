"use client";

import React from "react";
import "@farcaster/auth-kit/styles.css";
import { AuthKitProvider } from "@farcaster/auth-kit";

export default function AuthKitProviderWrapper({ children }: { children: React.ReactNode }) {
  const rpcUrl = process.env.NEXT_PUBLIC_FARC_RPC_URL || "https://mainnet.optimism.io";
  const domain = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const siweUri = typeof window !== "undefined" ? `${window.location.origin}/api/siwf` : "/api/siwf";

  const config = {
    rpcUrl,
    domain,
    siweUri,
  } as const;

  return <AuthKitProvider config={config}>{children}</AuthKitProvider>;
}
