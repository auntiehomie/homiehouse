/**
 * Authentication and authorization utilities
 *
 * Auth model: the client sends `x-farcaster-fid` and `x-signer-key` headers.
 * The server derives the Ed25519 public key from the private key and verifies
 * it against the local `user_signers` table, which is populated when signers
 * are verified as active with Hypersnap or recovered from the onchain key registry.
 *
 * This provides real Farcaster-native signer-key auth with server-side
 * verification — not just trusting client-supplied headers.
 */

import { NextRequest } from 'next/server';
import { getPublicKeyAsync as ed25519GetPublicKey } from '@noble/ed25519';
import { decodeFunctionResult, encodeFunctionData, parseAbi } from 'viem';
import { AuthError } from './errors';
import { sql } from './db';
import { verifySession, SessionError } from './session';
import type { SessionScope } from './session';
import { isActiveHypersnapSigner } from './hypersnap-signer-auth';

const KEY_REGISTRY = '0x00000000Fc1237824fb747aBDE0FF18990E59b7e' as const;
const OP_RPC = process.env.OP_RPC_URL || 'https://mainnet.optimism.io';
const keyRegistryAbi = parseAbi([
  'function keyDataOf(uint256 fid, bytes key) view returns ((uint8 state, uint32 keyType))',
]);

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
 * Used to cache verified legacy onchain signers for request authentication.
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
async function derivePublicKey(privateKeyHex: string): Promise<string> {
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
    const publicKeyBytes = await ed25519GetPublicKey(privateKeyBytes);
    return `0x${Buffer.from(publicKeyBytes).toString('hex')}`;
  } catch {
    throw new AuthError(
      'Invalid signer key — could not derive public key',
      401,
      'INVALID_SIGNER_KEY'
    );
  }
}

/**
 * Rehydrate the local cache from the Farcaster Key Registry. Hypersnap signers
 * are checked directly with Hypersnap before this legacy onchain fallback.
 */
async function recoverApprovedSigner(
  fid: number,
  publicKeyHex: string,
): Promise<boolean> {
  // Older HomieHouse signer records may not be in the local cache. Check the
  // derived public key against the FID's active onchain keys.
  try {
    const callData = encodeFunctionData({
      abi: keyRegistryAbi,
      functionName: 'keyDataOf',
      args: [BigInt(fid), publicKeyHex as `0x${string}`],
    });
    const response = await fetch(OP_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: KEY_REGISTRY, data: callData }, 'latest'],
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;

    const payload = await response.json();
    if (typeof payload.result !== 'string') return false;
    const keyData = decodeFunctionResult({
      abi: keyRegistryAbi,
      functionName: 'keyDataOf',
      data: payload.result as `0x${string}`,
    });
    if (keyData.state !== 1 || keyData.keyType !== 1) return false;

    await cacheApprovedSigner(fid, publicKeyHex);
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[auth] onchain signer recovery failed:', message);
    return false;
  }
}

// ── Request-level auth ────────────────────────────────────────────────────────

/**
 * Verify Farcaster signer auth from request headers.
 *
 * Preferred (P1 security):
 *   x-session-token:  JWT from POST /api/auth/session (post-challenge verify)
 *
 * Legacy (deprecated, P1 migration in progress):
 *   x-farcaster-fid:  the user's FID
 *   x-signer-key:    the Ed25519 signer private key hex
 *
 * The session-token path is checked first. If present, the JWT is verified
 * and the embedded FID is returned. Otherwise falls back to the legacy
 * x-signer-key raw private-key derivation path.
 *
 * Returns the verified FID.
 *
 * @param requiredScope — optional scope check for session tokens
 */
export async function verifyFarcasterSignerAuth(
  request: NextRequest,
  requiredScope?: SessionScope,
): Promise<number> {
  // ── P1: Prefer session token (nonce-signed challenge → short-lived JWT) ──
  const sessionToken = request.headers.get('x-session-token');
  if (sessionToken) {
    try {
      const scope = requiredScope ?? requiredSessionScope(request);
      if (!scope) {
        throw new AuthError(
          'Session permissions are not configured for this write route',
          403,
          'SESSION_SCOPE_UNCONFIGURED',
        );
      }
      const claims = await verifySession(sessionToken, scope);
      return claims.fid;
    } catch (err: any) {
      if (err instanceof AuthError) throw err;
      if (err instanceof SessionError) {
        throw new AuthError(err.message, err.status, err.code);
      }
      console.error('[auth] session verification error:', err?.message ?? err);
      throw new AuthError(
        'Session verification failed',
        500,
        'SESSION_VERIFICATION_FAILED',
      );
    }
  }

  // ── Legacy: x-signer-key raw private-key auth ──────────────────────────
  // TODO(HH-02): Remove once all clients have migrated to session tokens
  const fidHeader = request.headers.get('x-farcaster-fid');
  const signerKey = request.headers.get('x-signer-key');

  if (!fidHeader || !signerKey) {
    // Check for old Bearer token format (backward compat)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      throw new AuthError(
        'Legacy Bearer auth no longer supported. Use x-session-token header (POST /api/auth/session).',
        401,
        'LEGACY_AUTH_UNSUPPORTED',
      );
    }
    throw new AuthError(
      'Missing auth headers. Use x-session-token from /api/auth/session, or x-farcaster-fid + x-signer-key.',
      401,
      'MISSING_AUTH_HEADERS',
    );
  }

  const fid = Number(fidHeader);
  if (!fid || isNaN(fid) || fid <= 0) {
    throw new AuthError('Invalid FID', 401, 'INVALID_FID');
  }

  // Derive the public key from the provided private key
  // This validates the key is a real Ed25519 key (not arbitrary garbage)
  const publicKeyHex = await derivePublicKey(signerKey);

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
      // Hypersnap gasless KEY_ADD registrations are not in the legacy
      // Warpcast cache or Optimism Key Registry, even when posting works.
      if (await isActiveHypersnapSigner(fid, publicKeyHex)) return fid;

      // A valid legacy signer can outlive the database cache. Recover it from
      // the onchain key registry, while still requiring an exact FID/key match.
      const recovered = await recoverApprovedSigner(fid, publicKeyHex);
      if (recovered) return fid;

      throw new AuthError(
        'Invalid or unapproved signer key for this FID',
        401,
        'INVALID_SIGNER_KEY',
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
      'SIGNER_VERIFICATION_FAILED',
    );
  }

  return fid;
}

/** Require an explicit capability for every session-authenticated write. */
function requiredSessionScope(request: NextRequest): SessionScope | null {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return 'read:all';

  const path = new URL(request.url).pathname;
  const groups: Array<[SessionScope, string[]]> = [
    ['write:casts', ['/api/compose', '/api/schedule-cast', '/api/delete-cast']],
    ['write:lists', ['/api/curated-lists', '/api/curation/']],
    ['write:learn', [
      '/api/learning-completion', '/api/learning-progress', '/api/learning-plan',
      '/api/lesson', '/api/daily-challenge', '/api/streak-bonus', '/api/claim-hh2',
      '/api/premium-track',
    ]],
    ['write:shop', [
      '/api/stripe/', '/api/hh2-purchase', '/api/hh2-stake', '/api/owned-themes',
      '/api/pro/subscribe-crypto',
    ]],
    ['write:profile', ['/api/pfp-studio', '/api/push/subscribe']],
  ];

  for (const [scope, prefixes] of groups) {
    if (prefixes.some((prefix) => path === prefix || path.startsWith(prefix))) return scope;
  }
  return null;
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
    const publicKeyHex = await derivePublicKey(signerKey);
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

/** Verify that a provided Ed25519 private key belongs to an active signer for a FID. */
export async function verifyFarcasterSignerKey(fid: number, signerKey: string): Promise<number> {
  if (!fid || !Number.isSafeInteger(fid) || fid <= 0) {
    throw new AuthError('Valid FID required', 401, 'INVALID_FID');
  }
  const publicKeyHex = await derivePublicKey(signerKey);
  try {
    await ensureSignersTable();
    const rows = await sql`
      SELECT id FROM user_signers
      WHERE user_fid = ${fid}
        AND signer_public_key = ${publicKeyHex}
        AND status = 'approved'
      LIMIT 1
    `;
    if (rows.length > 0) return fid;
    if (await isActiveHypersnapSigner(fid, publicKeyHex)) return fid;
    if (await recoverApprovedSigner(fid, publicKeyHex)) return fid;
    throw new AuthError('Invalid or unapproved signer key for this FID', 401, 'INVALID_SIGNER_KEY');
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError('Unable to verify signer key', 500, 'SIGNER_VERIFICATION_FAILED');
  }
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
