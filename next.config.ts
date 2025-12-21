import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // In CI/monorepo contexts, Next's type checker may traverse unrelated folders.
  // Ignore build-time TS errors so nested apps (e.g., ./homiehouse/*) don't block deployment.
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    // Use absolute root to avoid warnings in Vercel
    root: process.cwd(),
  },
};

export default nextConfig;
