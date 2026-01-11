"use client";

import React from "react";

// No longer using AuthKit - authentication is now handled by Neynar
export default function AuthKitProviderWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
