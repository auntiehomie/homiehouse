/**
 * Onboarding Identity — POST /api/auth/onboarding-identity
 *
 * Records the user's identity path choice (new vs existing Farcaster account)
 * and updates both the users table and onboarding_state table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { setIdentityMode } from '@/lib/onboarding-storage';
import { AuthError } from '@/lib/errors';

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET (or JWT_SECRET) environment variable is not configured');
  }
  return new TextEncoder().encode(secret);
}

interface SessionPayload {
  userId: number;
  email: string;
  sub: string;
}

async function getUserIdFromSession(request: NextRequest): Promise<number> {
  const token = request.cookies.get('hh_session')?.value;
  if (!token) {
    throw new AuthError('Not authenticated', 401, 'NOT_AUTHENTICATED');
  }

  const secret = getSecret();
  const { payload } = await jwtVerify(token, secret);
  const session = payload as unknown as SessionPayload;
  return session.userId;
}

export async function POST(request: NextRequest) {
  try {
    // Verify session
    const userId = await getUserIdFromSession(request);

    // Parse body
    const body = await request.json().catch(() => null);
    const identityMode = body?.identityMode;

    if (identityMode !== 'new' && identityMode !== 'existing_connected') {
      return NextResponse.json(
        { error: 'identityMode must be "new" or "existing_connected"' },
        { status: 400 }
      );
    }

    // Update onboarding state
    await setIdentityMode(userId, identityMode as 'new' | 'existing_connected');

    return NextResponse.json({ ok: true, identityMode, stage: 'identity_ready' });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[onboarding-identity] Error:', err?.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}