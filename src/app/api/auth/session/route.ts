/**
 * POST /api/auth/session
 *
 * Exchange a verified Farcaster challenge payload for a short-lived
 * session JWT. The client must have already completed the challenge flow:
 *
 *   GET  /api/auth/challenge  → challenge string
 *   POST /api/auth/verify     → Hypersnap verification
 *   POST /api/auth/session    → session token (this endpoint)
 *
 * Body: { fid: number, signerPublicKey?: string }
 * The fid must match the one verified in /api/auth/verify.
 *
 * Returns: { ok: true, token: string, expiresAt: number }
 *
 * DELETE: Revoke the current session (logout).
 * PUT:    Refresh the session token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import {
  createSession,
  verifySession,
  revokeSession,
  refreshSession,
  SessionError,
} from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`auth-session:${ip}`, 10, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const fid = parseInt(String(body.fid), 10);
    if (!fid || isNaN(fid) || fid <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Valid FID required' },
        { status: 400 },
      );
    }

    const token = await createSession(fid, {
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