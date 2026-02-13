import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Exclude problematic packages from server component bundling
  serverExternalPackages: ['pino', 'thread-stream', '@walletconnect/logger', '@privy-io/react-auth'],
  turbopack: {
    // Use absolute root to avoid warnings in Vercel
    root: process.cwd(),
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('pino-pretty', 'lokijs', 'encoding', '@privy-io/react-auth');
    }
    return config;
  },
};

export default nextConfig;
