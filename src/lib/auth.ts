/**
 * Authentication and authorization utilities
 */

import { NextRequest } from 'next/server';
import { AuthError } from './errors';
import { validateUuid } from './validation';

// ── Signer-based authentication ──────────────────────────────────────────────

/**
 * In-memory signer verification cache (5-minute TTL, max 500 entries).
 * Each entry maps a signer UUID to the verified FID it belongs to.
 */
interface SignerCacheEntry {
  fid: number;
  expiresAt: number;
}

const signerCache = new Map<string, SignerCacheEntry>();
const SIGNER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const SIGNER_CACHE_MAX = 500;

/**
 * Verify a signer UUID via Neynar API and return the associated FID.
 * Results are cached for 5 minutes to avoid excessive Neynar calls.
 *
 * @param signerUuid - The signer UUID from the request
 * @returns The verified FID associated with this signer
 * @throws AuthError if signer is invalid, not approved, or missing
 */
export async function verifySignerAuth(signerUuid: string): Promise<number> {
  if (!signerUuid) {
    throw new AuthError('signerUuid is required', 401, 'MISSING_SIGNER');
  }

  // Validate UUID format
  validateUuid(signerUuid, 'signerUuid');

  // Check cache first
  const now = Date.now();
  const cached = signerCache.get(signerUuid);
  if (cached && cached.expiresAt > now) {
    return cached.fid;
  }

  // Call Neynar GET /signer endpoint
  const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
  if (!NEYNAR_API_KEY) {
    throw new AuthError('Server auth configuration error', 500, 'MISSING_CONFIG');
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
    console.error(`[verifySignerAuth] Neynar API error: status=${response.status}, body=${errorBody}`);

    if (response.status === 404) {
      throw new AuthError('Invalid signer', 401, 'INVALID_SIGNER');
    }
    if (response.status === 401 || response.status === 403) {
      throw new AuthError('Neynar API key invalid or expired', 500, 'NEYNAR_AUTH_FAILED');
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
