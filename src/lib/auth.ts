/**
 * Authentication and authorization utilities
 */

import { NextRequest } from 'next/server';
import { AuthError } from './errors';
import { validateUuid } from './validation';

// ── Signer-based authentication ──────────────────────────────────────────────

/**
 * In-memory signer verification cache (5-minute TTL, max 500 entries).
 * Each entry maps a signer UUID / public key to the verified FID it belongs to.
 */
interface SignerCacheEntry {
  fid: number;
  expiresAt: number;
}

const signerCache = new Map<string, SignerCacheEntry>();
const SIGNER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const SIGNER_CACHE_MAX = 500;

/**
 * Returns true if the given string looks like a Privy embedded-signer
 * Ed25519 public key (64 hex chars, optionally prefixed with 0x).
 */
function isPrivySignerKey(value: string): boolean {
  const stripped = value.startsWith('0x') ? value.slice(2) : value;
  return /^[0-9a-fA-F]{64}$/.test(stripped);
}

/**
 * Verify a signer and return the associated FID.
 *
 * TRANSITIONAL STATE — migration from Neynar signer UUIDs to Privy embedded signers:
 *
 * 1. If `signerUuid` is a 64-hex-char Ed25519 public key (Privy embedded signer),
 *    we treat it as valid and return FID 0.  The actual FID must be supplied
 *    separately from Privy's user object on the client side.
 *
 * 2. If `signerUuid` is a standard UUID format, we attempt Neynar verification
 *    for backward compatibility.  This path is deprecated; write routes are
 *    being migrated to the Privy embedded signer flow (see src/lib/farcaster-writes.ts).
 *    If NEYNAR_API_KEY is absent, we log a warning and return FID 0 rather
 *    than hard-failing — write routes will handle their own auth once migrated.
 *
 * @param signerUuid - Signer UUID (legacy Neynar) OR Ed25519 hex public key (Privy)
 * @returns The verified FID, or 0 for Privy public-key signers (FID comes from Privy user object)
 */
export async function verifySignerAuth(signerUuid: string): Promise<number> {
  if (!signerUuid) {
    throw new AuthError('signerUuid is required', 401, 'MISSING_SIGNER');
  }

  // ── Path 1: Privy embedded signer public key (Ed25519 hex) ──────────────
  if (isPrivySignerKey(signerUuid)) {
    // Public key is structurally valid; FID is provided separately by Privy's
    // user object — return 0 as sentinel so callers use the Privy-supplied FID.
    const now = Date.now();
    signerCache.set(signerUuid, { fid: 0, expiresAt: now + SIGNER_CACHE_TTL });
    return 0;
  }

  // ── Path 2: Legacy Neynar UUID (deprecated) ──────────────────────────────
  // Validate UUID format before hitting Neynar
  validateUuid(signerUuid, 'signerUuid');

  // Check cache first
  const now = Date.now();
  const cached = signerCache.get(signerUuid);
  if (cached && cached.expiresAt > now) {
    return cached.fid;
  }

  const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
  if (!NEYNAR_API_KEY) {
    // DEPRECATED: Neynar signer verification is being phased out.
    // Write routes are migrating to Privy embedded signer + HubRestAPIClient.
    // Return 0 rather than hard-failing so read-only paths stay functional.
    console.warn(
      '[verifySignerAuth] NEYNAR_API_KEY not set; Neynar signer verification is deprecated. ' +
      'Migrate write routes to Privy embedded signer. Returning FID 0.'
    );
    return 0;
  }

  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/signer?signer_uuid=${encodeURIComponent(signerUuid)}`,
    {
      headers: {
        'accept': 'application/json',
        'x-api-key': NEYNAR_API_KEY,
      },
    }
  );

  if (!response.ok) {
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch {
      // ignore
    }
    console.error(`[verifySignerAuth] API error: status=${response.status}, body=${errorBody}`);
    console.error(`[verifySignerAuth] Request URL: ${response.url}`);
    console.error(`[verifySignerAuth] Request headers: x-api-key=${NEYNAR_API_KEY ? '***' : 'missing'}`);

    if (response.status === 404) {
      throw new AuthError('Invalid signer', 401, 'INVALID_SIGNER');
    }
    if (response.status === 401 || response.status === 403) {
      throw new AuthError('API key invalid or expired', 500, 'AUTH_KEY_FAILED');
    }
    throw new AuthError(`Unable to verify signer (${response.status})`, 500, 'SIGNER_VERIFICATION_FAILED');
  }

  const data = await response.json();

  if (data.status !== 'approved') {
    throw new AuthError('Signer is not approved', 401, 'SIGNER_NOT_APPROVED');
  }

  if (!data.fid) {
    throw new AuthError('Signer has no associated FID', 401, 'SIGNER_NO_FID');
  }

  const fid = Number(data.fid);

  // Evict oldest if cache is full
  if (signerCache.size >= SIGNER_CACHE_MAX) {
    const firstKey = signerCache.keys().next().value;
    if (firstKey) signerCache.delete(firstKey);
  }

  // Cache the result
  signerCache.set(signerUuid, {
    fid,
    expiresAt: now + SIGNER_CACHE_TTL,
  });

  return fid;
}

// ── Bearer token auth ────────────────────────────────────────────────────────

/**
 * Verify authorization header with Bearer token
 */
export function verifyBearerToken(request: NextRequest): string {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    throw new AuthError('Authorization header required', 401, 'MISSING_AUTH_HEADER');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new AuthError('Invalid authorization format. Expected: Bearer <token>', 401, 'INVALID_AUTH_FORMAT');
  }

  const token = authHeader.substring(7);

  if (!token) {
    throw new AuthError('Token is required', 401, 'MISSING_TOKEN');
  }

  return token;
}

/**
 * Verify CRON secret for scheduled tasks.
 * Fails closed in production: if no secret is configured, rejects the request.
 */
export function verifyCronSecret(request: NextRequest, requiredSecret?: string): void {
  if (!requiredSecret) {
    if (process.env.NODE_ENV === 'production') {
      throw new AuthError('CRON_SECRET not configured', 500, 'MISSING_CRON_SECRET');
    }
    // Allow in development without secret
    return;
  }

  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${requiredSecret}`;

  if (authHeader !== expectedAuth) {
    throw new AuthError('Invalid or missing cron secret', 401, 'INVALID_CRON_SECRET');
  }
}

/**
 * Verify API key for internal API-to-API calls
 */
export function verifyApiKey(request: NextRequest): void {
  const apiKey = request.headers.get('x-api-key');
  const validApiKey = process.env.INTERNAL_API_KEY;

  if (!validApiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new AuthError('API key validation not configured', 500, 'MISSING_CONFIG');
    }
    return;
  }

  if (!apiKey || apiKey !== validApiKey) {
    throw new AuthError('Invalid or missing API key', 401, 'INVALID_API_KEY');
  }
}

/**
 * Optional auth - returns token if present, null otherwise
 */
export function getOptionalAuth(request: NextRequest): string | null {
  try {
    return verifyBearerToken(request);
  } catch {
    return null;
  }
}
