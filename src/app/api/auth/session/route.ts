/**
 * POST /api/auth/session
 *
 * Exchange either an approved Farcaster signer proof or a wallet-signed
 * Hypersnap protocol token for a short-lived session JWT.
 *
 *   POST /api/auth/session { protocolToken }
 *
 * The protocol token's FID is derived from server-side verification, never
 * trusted from the request body. Existing approved-signer clients still work.
 *
 * Returns: { ok: true, token: string, expiresAt: number }
 *
 * DELETE: Revoke the current session (logout).
 * PUT:    Refresh the session token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';
import {
  createSession,
  verifySession,
  revokeSession,
  refreshSession,
  SessionError,
} from '@/lib/session';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import {
  getHomieHouseAuthDomain,
  verifyHypersnapProtocolToken,
} from '@/lib/hypersnap-protocol-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = await checkRateLimit(
      `auth-session:${rateLimitKeyFromRequest(req)}`,
      10,
      60,
      { allowInMemoryPreview: true },
    );
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    // Session issuance is the authentication boundary. Require a direct
    // approved-signer proof here; do not accept an existing session token as
    // proof for minting another session.
    if (req.headers.get('x-session-token')) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Use a verified Hypersnap protocol token or approved signer to create a session',
        },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    let fid: number;
    let protocolAuth = false;

    if (typeof body.protocolToken === 'string') {
      if (body.protocolToken.length > 8_192) {
        return NextResponse.json(
          { ok: false, error: 'Login token is too large' },
          { status: 400 },
        );
      }

      const verified = await verifyHypersnapProtocolToken(
        body.protocolToken,
        getHomieHouseAuthDomain(req.nextUrl.host),
      );
      fid = verified.fid;
      protocolAuth = true;

      if (body.fid !== undefined && Number(body.fid) !== fid) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Authenticated FID does not match requested FID',
          },
          { status: 403 },
        );
      }
    } else {
      const requestedFid = parseInt(String(body.fid), 10);
      if (!requestedFid || isNaN(requestedFid) || requestedFid <= 0) {
        return NextResponse.json(
          { ok: false, error: 'Valid FID or protocolToken required' },
          { status: 400 },
        );
      }

      const verifiedFid = await verifyFarcasterSignerAuth(req);
      if (verifiedFid !== requestedFid) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Authenticated FID does not match requested FID',
          },
          { status: 403 },
        );
      }
      fid = verifiedFid;
    }

    const token = await createSession(fid, {
      // A wallet-proven identity alone does not mean the user has an
      // approved Ed25519 signer for Farcaster writes. Keep this session
      // read-only until the existing signer-approval flow is completed.
      ...(protocolAuth ? { scopes: ['read:all'] as const } : {}),
      userAgent: req.headers.get('user-agent'),
      ipAddress: ip,
    });

    const payload = await verifySession(token);
    const expiresAt = payload.exp * 1000;

    return NextResponse.json({
      ok: true,
      token,
      expiresAt,
      fid,
    });
  } catch (err: any) {
    if (err instanceof SessionError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.status },
      );
    }
    if (err instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.status },
      );
    }
    console.error('[auth/session] create error:', err?.message ?? err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to create session' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('x-session-token');
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Missing x-session-token header' },
        { status: 400 },
      );
    }

    await revokeSession(token);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err instanceof SessionError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.status },
      );
    }
    console.error('[auth/session] revoke error:', err?.message ?? err);
    return NextResponse.json(
      { ok: false, error: 'Failed to revoke session' },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = req.headers.get('x-session-token');
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Missing x-session-token header' },
        { status: 400 },
      );
    }

    const newToken = await refreshSession(token);
    if (!newToken) {
      // Not yet in refresh window — return current token info
      const claims = await verifySession(token);
      return NextResponse.json({
        ok: true,
        refreshed: false,
        expiresAt: claims.exp * 1000,
      });
    }

    const claims = await verifySession(newToken);
    return NextResponse.json({
      ok: true,
      refreshed: true,
      token: newToken,
      expiresAt: claims.exp * 1000,
      fid: claims.fid,
    });
  } catch (err: any) {
    if (err instanceof SessionError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.status },
      );
    }
    console.error('[auth/session] refresh error:', err?.message ?? err);
    return NextResponse.json(
      { ok: false, error: 'Failed to refresh session' },
      { status: 500 },
    );
  }
}
