/**
 * Authentication and authorization utilities
 */

import { NextRequest } from 'next/server';
import { AuthError } from './errors';

/**
 * Verify authorization header with Bearer token
 * @param request - Next.js request object
 * @returns Token if valid
 * @throws AuthError if invalid or missing
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
 * Verify CRON secret for scheduled tasks
 * @param request - Next.js request object
 * @param requiredSecret - Expected secret value (from env)
 * @throws AuthError if invalid or missing
 */
export function verifyCronSecret(request: NextRequest, requiredSecret?: string): void {
  if (!requiredSecret) {
    // If no secret is configured, allow the request
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
 * @param request - Next.js request object
 * @throws AuthError if invalid or missing
 */
export function verifyApiKey(request: NextRequest): void {
  const apiKey = request.headers.get('x-api-key');
  const validApiKey = process.env.INTERNAL_API_KEY;

  if (!validApiKey) {
    // If no API key is configured, skip validation (dev mode)
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
 * Useful for endpoints that have different behavior for authenticated users
 */
export function getOptionalAuth(request: NextRequest): string | null {
  try {
    return verifyBearerToken(request);
  } catch {
    return null;
  }
}

/**
 * Verify that a signer UUID belongs to the authenticated user
 * This is a placeholder - implement based on your auth provider (Privy, etc.)
 * 
 * @param signerUuid - The signer UUID to validate
 * @param userId - The authenticated user's ID
 * @throws AuthError if signer doesn't belong to user
 */
export async function verifySignerOwnership(
  signerUuid: string,
  userId: string
): Promise<void> {
  // TODO: Implement actual verification by checking your signer database
  // Example:
  // const signer = await db.signers.findByUuid(signerUuid);
  // if (signer.userId !== userId) {
  //   throw new AuthError('Signer does not belong to user', 403, 'FORBIDDEN');
  // }
  
  // For now, just log a warning
  console.warn('[Auth] Signer ownership verification not implemented', {
    signerUuid: signerUuid.substring(0, 8) + '...',
    userId,
  });
}

/**
 * Verify that a user has permission to act as a specific FID
 * 
 * @param fid - The Farcaster ID
 * @param userId - The authenticated user's ID
 * @throws AuthError if user doesn't own the FID
 */
export async function verifyFidOwnership(
  fid: number,
  userId: string
): Promise<void> {
  // TODO: Implement actual verification by checking user's connected accounts
  // Example:
  // const user = await db.users.findById(userId);
  // if (!user.fids.includes(fid)) {
  //   throw new AuthError('FID does not belong to user', 403, 'FORBIDDEN');
  // }
  
  // For now, just log a warning
  console.warn('[Auth] FID ownership verification not implemented', {
    fid,
    userId,
  });
}

/**
 * Rate limiting check (placeholder)
 * Implement with Redis/Upstash or similar
 */
export async function checkRateLimit(
  identifier: string,
  limit: number = 10,
  windowSeconds: number = 60
): Promise<void> {
  // TODO: Implement rate limiting with Redis
  // Example using Upstash Redis:
  // const ratelimit = new Ratelimit({
  //   redis: Redis.fromEnv(),
  //   limiter: Ratelimit.slidingWindow(limit, `${windowSeconds}s`),
  // });
  // const { success } = await ratelimit.limit(identifier);
  // if (!success) {
  //   throw new RateLimitError();
  // }
  
  // For now, just log
  if (process.env.NODE_ENV === 'production') {
    console.warn('[Auth] Rate limiting not implemented. Please add Upstash Redis or similar.');
  }
}
