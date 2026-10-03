/**
 * Session management — short-lived scoped JWT sessions
 *
 * Replaces the P1 security issue of sending the raw Ed25519 private key
 * (x-signer-key header) on every API request. Instead:
 *
 *   1. Client gets a challenge from /api/auth/challenge
 *   2. Client signs it and submits to /api/auth/verify → Hypersnap
 *   3. Client exchanges the verified payload for a session token via POST /api/auth/session
 *   4. Subsequent API calls send x-session-token (JWT) instead of x-signer-key
 *
 * Sessions are short-lived (default 24h), server-signed JWTs with FID + scope claims.
 * Backward compat with x-signer-key is maintained during migration.
 */

import * as jose from 'jose';
import { sql } from './db';

// ── Configuration ────────────────────────────────────────────────────────────

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days absolute max with renewal
const REFRESH_WINDOW_MS = 1 * 60 * 60 * 1000; // can refresh within last hour

export type SessionScope = 'write:casts' | 'write:lists' | 'write:learn' | 'write:profile' | 'write:shop' | 'read:all';

interface SessionClaims {
  fid: number;
  scopes: SessionScope[];
  iat: number;
  exp: number;
}

// ── Key management ────────────────────────────────────────────────────────────

let _signingKey: Uint8Array | null = null;
let _verificationKey: Uint8Array | null = null;

/**
 * Derive a symmetric signing key from the configured SESSION_SECRET env var.
 * If not configured, generates a random key valid only for the process lifetime
 * (sessions won't survive restarts in dev without SESSION_SECRET).
 */
async function getSigningKey(): Promise<Uint8Array> {
  if (_signingKey) return _signingKey;

  const secret = process.env.SESSION_SECRET;
  if (secret) {
    // Derive a 256-bit key from the secret using SHA-256
    const encoder = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
    _signingKey = new Uint8Array(hash);
    _verificationKey = _signingKey; // symmetric
    return _signingKey;
  }

  // Fallback: generate random key for process lifetime
  _signingKey = crypto.getRandomValues(new Uint8Array(32));
  _verificationKey = _signingKey;
  console.warn(
    '[session] SESSION_SECRET not configured — sessions will not survive restarts',
  );
  return _signingKey;
}

// ── Session DB table ─────────────────────────────────────────────────────────

let sessionsTableReady = false;

async function ensureSessionsTable(): Promise<void> {
  if (sessionsTableReady) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_fid INTEGER NOT NULL,
        session_id TEXT NOT NULL UNIQUE,
        scopes TEXT[] NOT NULL DEFAULT '{"read:all"}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ DEFAULT NOW(),
        user_agent TEXT,
        ip_address TEXT
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_sessions_fid
      ON sessions(user_fid, revoked_at, expires_at)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_sessions_session_id
      ON sessions(session_id)
    `;
    sessionsTableReady = true;
  } catch (err: any) {
    console.warn('[session] could not ensure sessions table:', err?.message);
  }
}

// ── Core API ─────────────────────────────────────────────────────────────────

/**
 * Create a session JWT for an authenticated FID.
 *
 * Called after successful /api/auth/verify (Farcaster challenge-signing)
 * to issue a short-lived session token the client uses for subsequent API calls.
 */
export async function createSession(
  fid: number,
  options?: {
    scopes?: SessionScope[];
    userAgent?: string | null;
    ipAddress?: string | null;
  },
): Promise<string> {
  const key = await getSigningKey();
  const scopes = options?.scopes ?? ['read:all', 'write:casts', 'write:lists', 'write:learn', 'write:profile', 'write:shop'];

  const now = Math.floor(Date.now() / 1000);
  const sessionId = crypto.randomUUID();

  const claims: SessionClaims & { jti: string } = {
    fid,
    scopes,
    iat: now,
    exp: now + Math.floor(SESSION_DURATION_MS / 1000),
    jti: sessionId,
  };

  const jwt = await new jose.SignJWT(claims as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(claims.iat)
    .setExpirationTime(claims.exp)
    .setJti(sessionId)
    .sign(key);

  // Persist session metadata for revocation support
  await ensureSessionsTable();
  try {
    await sql`
      INSERT INTO sessions
        (user_fid, session_id, scopes, expires_at, user_agent, ip_address)
      VALUES (
        ${fid},
        ${sessionId},
        ${scopes},
        ${new Date(claims.exp * 1000).toISOString()},
        ${options?.userAgent ?? null},
        ${options?.ipAddress ?? null}
      )
    `;
  } catch (err: any) {
    console.warn('[session] could not persist session metadata:', err?.message);
    // Non-fatal: the JWT is still valid even if DB write fails
  }

  return jwt;
}

/**
 * Verify a session token and return the claims if valid.
 *
 * Checks:
 *   - JWT signature is valid
 *   - Token has not expired
 *   - Session has not been revoked in the DB
 */
export async function verifySession(
  token: string,
  requiredScope?: SessionScope,
): Promise<SessionClaims> {
  const key = await getSigningKey();

  let payload: jose.JWTPayload;
  try {
    const result = await jose.jwtVerify(token, key, {
      algorithms: ['HS256'],
    });
    payload = result.payload;
  } catch (err: any) {
    throw new SessionError(
      `Invalid or expired session token: ${err?.message ?? 'unknown error'}`,
      401,
      'INVALID_SESSION',
    );
  }

  const fid = Number(payload.fid);
  if (!fid || isNaN(fid) || fid <= 0) {
    throw new SessionError('Invalid session: missing FID', 401, 'INVALID_SESSION');
  }

  // Check revocation
  const sessionId = payload.jti as string;
  if (sessionId) {
    await ensureSessionsTable();
    try {
      const rows = await sql`
        SELECT revoked_at FROM sessions
        WHERE session_id = ${sessionId}
          AND revoked_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
      `;
      if (rows.length === 0) {
        throw new SessionError(
          'Session has been revoked or expired',
          401,
          'SESSION_REVOKED',
        );
      }
      // Update last_used_at
      await sql`
        UPDATE sessions SET last_used_at = NOW()
        WHERE session_id = ${sessionId}
      `;
    } catch (err: any) {
      if (err instanceof SessionError) throw err;
      // DB check failure: fail-open if token is otherwise valid
      console.warn('[session] DB revocation check failed:', err?.message);
    }
  }

  // Check scope
  if (requiredScope) {
    const scopes = (payload.scopes as SessionScope[]) ?? [];
    if (!scopes.includes(requiredScope)) {
      throw new SessionError(
        `Session missing required scope: ${requiredScope}`,
        403,
        'INSUFFICIENT_SCOPE',
      );
    }
  }

  return {
    fid,
    scopes: (payload.scopes as SessionScope[]) ?? ['read:all'],
    iat: payload.iat!,
    exp: payload.exp!,
  };
}

/**
 * Revoke a session by JWT token (extracts jti from token).
 */
export async function revokeSession(token: string): Promise<void> {
  const key = await getSigningKey();
  let payload: jose.JWTPayload;
  try {
    const result = await jose.jwtVerify(token, key, { algorithms: ['HS256'] });
    payload = result.payload;
  } catch {
    // Token already expired/invalid — nothing to revoke
    return;
  }

  const sessionId = payload.jti as string;
  if (!sessionId) return;

  await ensureSessionsTable();
  try {
    await sql`
      UPDATE sessions SET revoked_at = NOW()
      WHERE session_id = ${sessionId} AND revoked_at IS NULL
    `;
  } catch (err: any) {
    console.warn('[session] revoke failed:', err?.message);
  }
}

/**
 * Revoke all sessions for a FID (e.g., on logout-all).
 */
export async function revokeAllSessions(fid: number): Promise<void> {
  await ensureSessionsTable();
  try {
    await sql`
      UPDATE sessions SET revoked_at = NOW()
      WHERE user_fid = ${fid} AND revoked_at IS NULL
    `;
  } catch (err: any) {
    console.warn('[session] revoke-all failed:', err?.message);
  }
}

/**
 * Refresh a session token if within the renewal window.
 * Returns a new JWT with extended expiry, revoking the old one.
 */
export async function refreshSession(token: string): Promise<string | null> {
  const claims = await verifySession(token);
  const now = Math.floor(Date.now() / 1000);
  const remaining = claims.exp - now;

  // Only refresh within the last hour, or if already expired
  if (remaining > REFRESH_WINDOW_MS / 1000 && remaining > 0) {
    return null; // Not yet in refresh window
  }

  // Revoke old session
  await revokeSession(token);

  // Issue new session with same scopes
  return createSession(claims.fid, { scopes: claims.scopes });
}

// ── Migration helper — extract x-signer-key usage sites ──────────────────────

/**
 * Returns the number of active sessions for a FID.
 */
export async function getActiveSessionCount(fid: number): Promise<number> {
  await ensureSessionsTable();
  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS count FROM sessions
      WHERE user_fid = ${fid}
        AND revoked_at IS NULL
        AND expires_at > NOW()
    `;
    return rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

// ── Error type ───────────────────────────────────────────────────────────────

export class SessionError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'SessionError';
    this.status = status;
    this.code = code;
  }
}