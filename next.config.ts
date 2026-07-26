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

// Security headers flagged as missing in the 2026-05-23 audit (CSP, HSTS,
// X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy).
//
// Two things keep this from being a blind lockdown:
//
// 1. Farcaster mini-apps are LOADED IN AN IFRAME by the host client (see
//    src/app/.well-known/farcaster.json's homeUrl: /mini/ask-homie) —
//    framing them is the whole point, not a vulnerability. X-Frame-Options
//    and CSP's frame-ancestors are scoped to exclude /mini/*, /api/frame/*,
//    and /.well-known/* so the mini-app and Frame endpoints stay embeddable
//    by any Farcaster client, while everything else (the main app) is
//    locked to same-origin framing only.
//
// 2. The app pulls in several third-party auth/wallet SDKs (Privy,
//    RainbowKit, wagmi, WalletConnect) whose exact runtime script/connect/
//    frame origins aren't fully enumerable from source alone, and there's
//    no environment here to live-test a full wallet-connect flow against a
//    strict CSP. Shipping a too-strict enforced CSP risks silently breaking
//    login — worse than not having one. So CSP ships as
//    Content-Security-Policy-Report-Only: it reports violations (visible in
//    browser devtools / a configured report-uri) without blocking anything,
//    which is the standard safe rollout path. Once a deploy's console is
//    checked for false positives, swap the header name to
//    Content-Security-Policy to actually enforce it.
const APP_FRAME_ANCESTORS = "frame-ancestors 'self'";
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // Next.js hydration + wallet SDKs need inline/eval at runtime; tightening
  // this further requires a nonce-based setup, which needs its own testing pass.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline'", // multiple components inject <style>{`@keyframes...`}</style>
  "img-src 'self' data: https:", // avatars/token logos come from arbitrary HTTPS hosts (see images.remotePatterns)
  "font-src 'self' data:",
  "connect-src 'self' https: wss:", // Hypersnap, RPC endpoints, WalletConnect relay, Privy, Sentry, etc.
  "frame-src 'self' https:", // WalletConnect / Privy auth iframes
  APP_FRAME_ANCESTORS,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
];

// Routes that Farcaster clients embed via iframe — must stay frameable by
// any origin, so this block omits X-Frame-Options and relaxes frame-ancestors.
// Defined AFTER the catch-all in headers() below so it wins for these paths.
const FRAMEABLE_HEADERS = SECURITY_HEADERS
  .filter((h) => h.key !== 'X-Frame-Options')
  .map((h) =>
    h.key === 'Content-Security-Policy-Report-Only'
      ? { ...h, value: CSP_REPORT_ONLY.replace(APP_FRAME_ANCESTORS, 'frame-ancestors *') }
      : h
  );

const nextConfig: NextConfig = {
  images: {
    // Farcaster avatars and token logos can come from any domain — allow all HTTPS sources
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      { source: '/mini/:path*', headers: FRAMEABLE_HEADERS },
      { source: '/api/frame/:path*', headers: FRAMEABLE_HEADERS },
      { source: '/.well-known/:path*', headers: FRAMEABLE_HEADERS },
    ];
  },
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
