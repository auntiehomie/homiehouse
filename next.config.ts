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
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  // Exclude problematic packages from server component bundling
  experimental: {
    serverComponentsExternalPackages: ['pino', 'thread-stream'],
  },
};

export default nextConfig;
