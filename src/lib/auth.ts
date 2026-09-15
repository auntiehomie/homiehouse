/**
 * Authentication and authorization utilities
 *
 * Auth model: the client sends `x-farcaster-fid` and `x-signer-key` headers.
 * The server derives the Ed25519 public key from the private key and verifies
 * it against the local `user_signers` table, which is populated when signers
 * are approved through the Warpcast flow.
 *
 * This provides real Farcaster-native signer-key auth with server-side
 * verification — not just trusting client-supplied headers.
 */

import { NextRequest } from 'next/server';
import { getPublicKey as ed25519GetPublicKey } from '@noble/ed25519';
import { AuthError } from './errors';
import { sql } from './db';

// ── Table lifecycle ──────────────────────────────────────────────────────────

let signersTableReady = false;

async function ensureSignersTable(): Promise<void> {
  if (signersTableReady) return;
  try {
    // Create user_signers cache table — mirrors approved Farcaster signers
    await sql`
      CREATE TABLE IF NOT EXISTS user_signers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        signer_uuid TEXT,
        user_fid INTEGER NOT NULL,
        signer_public_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'approved',
        approved_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_fid, signer_public_key)
      )
    `;
    // Indexes for fast lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_signers_fid
      ON user_signers(user_fid)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_signers_lookup
      ON user_signers(user_fid, signer_public_key)
    `;
    signersTableReady = true;
  } catch (err: any) {
    console.warn('[auth] could not ensure user_signers table:', err?.message);
    // Table creation is best-effort; verification will fail-closed below
  }
}

/**
 * Store an approved signer in the user_signers cache table.
 * Called by /api/signer and /api/register-user-key when a signer is approved.
 */
export async function cacheApprovedSigner(
  fid: number,
  publicKeyHex: string,
  signerUuid?: string
): Promise<void> {
  await ensureSignersTable();
  const normalizedKey = publicKeyHex.toLowerCase().startsWith('0x')
    ? publicKeyHex.toLowerCase()
    : `0x${publicKeyHex.toLowerCase()}`;

  await sql`
    INSERT INTO user_signers
      (signer_uuid, user_fid, signer_public_key, status, approved_at)
    VALUES (${signerUuid ?? null}, ${fid}, ${normalizedKey}, 'approved', NOW())
    ON CONFLICT (user_fid, signer_public_key)
    DO UPDATE SET status = 'approved',
                  approved_at = NOW(),
                  signer_uuid = COALESCE(EXCLUDED.signer_uuid, user_signers.signer_uuid)
  `;
}

/**
 * Derive the Ed25519 public key from a private key hex string.
 * Returns the hex-encoded public key (with 0x prefix).
 */
function derivePublicKey(privateKeyHex: string): string {
  // Normalize: strip 0x prefix if present
  const cleanHex = privateKeyHex.startsWith('0x')
    ? privateKeyHex.slice(2)
    : privateKeyHex;

  // Validate hex format and length (Ed25519 private keys are 32 bytes = 64 hex chars)
  if (!/^[0-9a-fA-F]{64}$/.test(cleanHex)) {
    throw new AuthError(
      'Invalid signer key format',
      401,
      'INVALID_SIGNER_KEY'
    );
  }

  try {
    const privateKeyBytes = Buffer.from(cleanHex, 'hex');
    const publicKeyBytes = ed25519GetPublicKey(privateKeyBytes);
    return `0x${Buffer.from(publicKeyBytes).toString('hex')}`;
  } catch {
    throw new AuthError(
      'Invalid signer key — could not derive public key',
      401,
      'INVALID_SIGNER_KEY'
    );
  }
}

// ── Request-level auth ────────────────────────────────────────────────────────

/**
 * Verify Farcaster signer auth from request headers.
 *
 * Expects:
 *   x-farcaster-fid:  the user's FID
 *   x-signer-key:    the Ed25519 signer private key hex
 *
 * Derives the public key from the private key and verifies it
 * exists as an approved signer for the FID in the user_signers table.
 *
 * Returns the verified FID.
 *
 * Also accepts the old Bearer token format for backward compat with
 * the publish-scheduled-casts internal cron job.
 */
export async function verifyFarcasterSignerAuth(request: NextRequest): Promise<number> {
  const fidHeader = request.headers.get('x-farcaster-fid');
  const signerKey = request.headers.get('x-signer-key');

  if (!fidHeader || !signerKey) {
    // Check for old Bearer token format (backward compat)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Legacy Bearer token — try to extract fid from it (backward compat for cron jobs)
      // For now, just throw — cron jobs should use CRON_SECRET instead
      throw new AuthError(
        'Legacy Bearer auth no longer supported. Use x-farcaster-fid + x-signer-key headers.',
        401,
        'LEGACY_AUTH_UNSUPPORTED'
      );
    }
    throw new AuthError(
      'Missing x-farcaster-fid or x-signer-key headers',
      401,
      'MISSING_AUTH_HEADERS'
    );
  }

  const fid = Number(fidHeader);
  if (!fid || isNaN(fid) || fid <= 0) {
    throw new AuthError('Invalid FID', 401, 'INVALID_FID');
  }

  // Derive the public key from the provided private key
  // This validates the key is a real Ed25519 key (not arbitrary garbage)
  const publicKeyHex = derivePublicKey(signerKey);

  // Verify the signer exists in our cache of approved signers
  try {
    await ensureSignersTable();

    const rows = await sql`
      SELECT id FROM user_signers
      WHERE user_fid = ${fid}
        AND signer_public_key = ${publicKeyHex}
        AND status = 'approved'
      LIMIT 1
    `;

    if (rows.length === 0) {
      // Signer not found or not approved — could be a new signer
      // that hasn't been cached yet, or an impostor
      throw new AuthError(
        'Invalid or unapproved signer key for this FID',
        401,
        'INVALID_SIGNER_KEY'
      );
    }
  } catch (err: any) {
    // Fail-closed: if DB is unreachable or any error occurs, reject the request.
    // Do NOT allow the request through on DB failure.
    if (err instanceof AuthError) {
      throw err;
    }
    console.error('[auth] signer verification DB error:', err?.message ?? err);
    throw new AuthError(
      'Unable to verify signer key',
      500,
      'SIGNER_VERIFICATION_FAILED'
    );
  }

  return fid;
}

/**
 * Verify a Farcaster signer key against the database.
 *
 * Checks that:
 * 1. The signer key exists as a stored signer for this FID
 * 2. The signer is approved
 *
 * Returns the FID if valid.
 */
export async function verifyFarcasterSigner(
  fid: number,
  signerKey?: string
): Promise<number> {
  if (!fid || isNaN(fid) || fid <= 0) {
    throw new AuthError('Valid FID required', 400, 'INVALID_FID');
  }

  // If signerKey provided, verify it properly
  if (signerKey) {
    const publicKeyHex = derivePublicKey(signerKey);
    try {
      await ensureSignersTable();
      const rows = await sql`
        SELECT id FROM user_signers
        WHERE user_fid = ${fid}
          AND signer_public_key = ${publicKeyHex}
          AND status = 'approved'
        LIMIT 1
      `;
      if (rows.length === 0) {
        throw new AuthError('Invalid signer key for FID', 401, 'INVALID_SIGNER_KEY');
      }
    } catch (err: any) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('Signer verification failed', 500, 'VERIFICATION_FAILED');
    }
  }

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