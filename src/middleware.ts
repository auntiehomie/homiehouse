import { NextRequest, NextResponse } from "next/server";

/**
 * CORS middleware — adds appropriate Access-Control-* headers to every
 * response so browsers can call Homiehouse API endpoints cross-origin.
 *
 * - Frame / mini-app / well-known paths get a wildcard allow-origin because
 *   any Farcaster client must be able to embed them.
 * - The rest of /api/* is restricted to an allow-list. Reflecting the request
 *   Origin back, as this previously did, makes the policy equivalent to `*`
 *   while looking selective: every API response became readable by any site
 *   the user happened to visit. Extra origins can be added via the
 *   CORS_ALLOWED_ORIGINS env var (comma-separated).
 * - Non-API routes skip CORS headers entirely; they're same-origin.
 *
 * Also handles OPTIONS pre-flight requests so the browser doesn't error
 * out before the real request even fires.
 *
 * This was the missing piece flagged in the CORS audit (2026-08-01):
 * the codebase had zero CORS handling — no Access-Control-Allow-Origin,
 * no middleware.
 */

const FRAMEABLE_PREFIXES = ["/mini", "/api/frame", "/.well-known"];

/** Origins allowed to read regular /api/* responses cross-origin. */
const DEFAULT_ALLOWED_ORIGINS = [
  "https://homiehouse.lol",
  "https://www.homiehouse.lol",
  "https://homiehouse.vercel.app",
];

const ALLOWED_ORIGINS = new Set(
  [
    ...DEFAULT_ALLOWED_ORIGINS,
    process.env.NEXT_PUBLIC_BASE_URL,
    ...(process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? []),
  ]
    .map((o) => o?.trim())
    .filter((o): o is string => Boolean(o)),
);

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Vercel preview deployments for this project.
  try {
    const { hostname, protocol } = new URL(origin);
    return (
      protocol === "https:" &&
      /^homiehouse-[a-z0-9-]+\.vercel\.app$/.test(hostname)
    );
  } catch {
    return false;
  }
}

function isFrameable(pathname: string): boolean {
  return FRAMEABLE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");

  // Only add CORS to API + frameable routes
  const addCors = isApiRoute(pathname) || isFrameable(pathname);
  if (!addCors) return NextResponse.next();

  // Handle pre-flight
  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    setCorsHeaders(response, pathname, origin);
    return response;
  }

  const response = NextResponse.next();
  setCorsHeaders(response, pathname, origin);
  return response;
}

function setCorsHeaders(
  response: NextResponse,
  pathname: string,
  origin: string | null,
) {
  // Frame/mini-app endpoints must work from any Farcaster client.
  if (isFrameable(pathname)) {
    response.headers.set("Access-Control-Allow-Origin", "*");
  } else if (origin && isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  } else if (origin) {
    // Not on the allow-list: omit the header so the browser blocks the read.
    response.headers.set("Vary", "Origin");
  }

  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Farcaster-Auth, x-api-key, x-farcaster-fid, x-signer-key",
  );
  response.headers.set("Access-Control-Max-Age", "86400");
}

export const config = {
  // Run on API routes + the frame/mini/well-known paths that hosts embed.
  // Avoid running on every page render.
  matcher: ["/api/:path*", "/mini/:path*", "/.well-known/:path*"],
};
