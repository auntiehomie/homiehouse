/**
 * Verify Magic Link — GET /api/auth/verify-magic
 *
 * Validates a magic link token, creates a JWT session cookie,
 * and redirects to /onboarding (new users) or /feed (active users).
 *
 * If the token is invalid/expired, returns a 404 JSON error page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { verifyMagicLinkToken, getUserByEmail, getOnboardingState } from '@/lib/onboarding-storage';
import { updateOnboardingStage } from '@/lib/onboarding-storage';

// ── JWT helpers ──────────────────────────────────────────────────────────────

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET (or JWT_SECRET) environment variable is not configured');
  }
  return new TextEncoder().encode(secret);
}

async function createSessionToken(
  userId: number,
  email: string
): Promise<string> {
  const secret = getSecret();
  const jwt = await new SignJWT({ userId, email, sub: String(userId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);

  return jwt;
}

// ── GET handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const token = searchParams.get('token');

    // Validate token presence
    if (!token) {
      return NextResponse.json({ error: 'Invalid or missing token' }, { status: 400 });
    }

    // Verify magic link token
    const verifyResult = await verifyMagicLinkToken(token);

    if (!verifyResult) {
      return NextResponse.json(
        { error: 'Invalid or expired link. Please request a new one.' },
        { status: 404 }
      );
    }

    const { email, userId } = verifyResult;

    // Get user — advance stage if needed
    const user = await getUserByEmail(email);
    if (user) {
      // If user was at 'pending', promote to 'email_verified'
      if (user.onboarding_stage === 'pending') {
        try {
          await updateOnboardingStage(userId, 'email_verified');
        } catch (stageErr: any) {
          console.warn('[verify-magic] Could not update onboarding stage:', stageErr?.message);
          // Non-fatal — proceed with session creation
        }
      }
    }

    // Create session JWT
    const sessionToken = await createSessionToken(userId, email);

    // Set session cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    };

    // Determine redirect URL
    let redirectUrl: string;
    if (!user) {
      redirectUrl = '/onboarding';
    } else if (user.onboarding_stage === 'activated') {
      redirectUrl = '/feed';
    } else {
      redirectUrl = '/onboarding';
    }

    const response = NextResponse.redirect(
      new URL(redirectUrl, request.nextUrl.origin),
      { status: 302 }
    );
    response.cookies.set('hh_session', sessionToken, cookieOptions);

    return response;
  } catch (err: any) {
    console.error('[verify-magic] Unexpected error:', err?.message);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}