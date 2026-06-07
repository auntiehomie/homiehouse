/**
 * Authentication and authorization utilities
 */

import { NextRequest } from 'next/server';
import { AuthError } from './errors';

// Lazy Privy client — only initialized when first used
let _privyClient: any = null;

function getPrivyClient() {
  if (!_privyClient) {
    const { PrivyClient } = require('@privy-io/server-auth');
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;
    if (!appId || !appSecret) {
      throw new AuthError('Privy credentials not configured', 500, 'MISSING_PRIVY_CONFIG');
    }
    _privyClient = new PrivyClient(appId, appSecret);
  }
  return _privyClient;
}

/**
 * Verify a Privy auth token from the Authorization header.
 * Returns the verified claims (userId, linked accounts, etc.)
 * Throws AuthError if token is missing or invalid.
 */
export async function verifyPrivyAuth(request: NextRequest): Promise<any> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid authorization header', 401, 'MISSING_AUTH_HEADER');
  }
  const token = authHeader.substring(7);
  if (!token) {
    throw new AuthError('Token is required', 401, 'MISSING_TOKEN');
  }
  try {
    const client = getPrivyClient();
    const claims = await client.verifyAuthToken(token);
    return claims;
  } catch (err: any) {
    throw new AuthError(err?.message || 'Invalid or expired token', 401, 'INVALID_TOKEN');
  }
}

/**
 * Verify that a Farcaster signer (private key or UUID) belongs to the
 * authenticated user by checking the linked Farcaster account in their
 * Privy claims.
 *
 * This prevents users from using another user's signer to post casts.
 *
 * @param claims - Verified Privy auth claims
 * @param expectedFid - The FID the signer should belong to (optional)
 * @returns The user's Farcaster FID
 * @throws AuthError if signer doesn't match the user's linked Farcaster account
 */
export function verifyFarcasterSigner(
  claims: any,
  expectedFid?: number
): number {
  const linkedAccounts = claims?.linkedAccounts ?? [];
  const farcasterAccount = linkedAccounts.find(
    (a: any) => a.type === 'farcaster' || a.provider === 'farcaster'
  );

  if (!farcasterAccount) {
    throw new AuthError(
      'No Farcaster account linked to this user',
      403,
      'NO_FARCASTER_ACCOUNT'
    );
  }

  const fid = farcasterAccount.fid ?? farcasterAccount.subject;
  if (!fid) {
    throw new AuthError(
      'Could not determine Farcaster FID from linked account',
      403,
      'MISSING_FID'
    );
  }

  if (expectedFid !== undefined && Number(fid) !== Number(expectedFid)) {
    throw new AuthError(
      'Signer FID does not match authenticated user',
      403,
      'FID_MISMATCH'
    );
  }

  return Number(fid);
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
