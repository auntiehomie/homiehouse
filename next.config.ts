import type { NextConfig } from "next";
// withSentryConfig is loaded conditionally so the build doesn't fail without Sentry installed
let withSentryConfig: ((config: NextConfig, options?: Record<string, unknown>) => NextConfig) | null = null;
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sentry = require('@sentry/nextjs');
    withSentryConfig = sentry.withSentryConfig;
  } catch {
    // @sentry/nextjs not installed yet — skip wrapping
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      // Serve SW dynamically so the deployment timestamp changes on each deploy,
      // letting the browser detect new versions and show the update banner.
      { source: '/sw.js', destination: '/api/sw' },
    ];
  },
  reactCompiler: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Expose Hypersnap base URL to the browser bundle.
  // Override at deploy time via NEXT_PUBLIC_HYPERSNAP_URL env var.
  env: {
    NEXT_PUBLIC_HYPERSNAP_URL: process.env.NEXT_PUBLIC_HYPERSNAP_URL || 'https://haatz.quilibrium.com',
    NEXT_PUBLIC_FARCASTER_HUB_URL: process.env.NEXT_PUBLIC_FARCASTER_HUB_URL || 'https://nemes.farcaster.xyz:2281',
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

export default withSentryConfig
  ? withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    })
  : nextConfig;
