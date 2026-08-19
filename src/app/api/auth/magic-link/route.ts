/**
 * Magic Link Auth — POST /api/auth/magic-link
 *
 * Accepts an email, validates it, rate-limits, generates a one-time token
 * stored in magic_link_tokens, and emails the user a sign-in link.
 *
 * Returns { ok: true } regardless of whether the email is registered,
 * to avoid leaking account existence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getUserByEmail, createOrUpdateUser, createMagicLinkToken } from '@/lib/onboarding-storage';
import { sendMagicLinkEmail } from '@/lib/email';
import { AuthError } from '@/lib/errors';
import { rateLimit } from '@/lib/ratelimit';

// ── Helpers ──────────────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  // Basic RFC 5322-ish check — covers 99.9% of real emails
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs (client, proxy, ...)
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = (body?.email || '').toString().trim().toLowerCase();

    // Validate email format
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ ok: true }); // Don't leak validity
    }

    // Rate limit: 10 per IP per hour
    const ip = getClientIp(request);
    const ipRateLimit = rateLimit(`ml-ip:${ip}`, 10, 3600);
    if (!ipRateLimit.success) {
      return NextResponse.json(
        { ok: true }, // Don't leak rate limit to unauthenticated users
        { status: 200 }
      );
    }

    // Rate limit: 3 per email per 10 minutes
    const emailRateLimit = rateLimit(`ml-email:${email}`, 3, 600);
    if (!emailRateLimit.success) {
      return NextResponse.json({ ok: true }); // Don't leak rate limit
    }

    // Generate secure random token
    const token = randomBytes(32).toString('hex');

    // Create or find user
    const user = await createOrUpdateUser({
      email,
      onboarding_stage: 'pending' as const,
    });

    // Store token with 15-minute expiry
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await createMagicLinkToken(token, email, user.id, expiresAt);

    // Send magic link email
    const baseUrl = request.nextUrl.origin;
    const emailResult = await sendMagicLinkEmail(email, token, baseUrl);

    if (!emailResult.ok) {
      console.error('[magic-link] Failed to send email, but token was created:', emailResult.error);
      // Still return ok — token exists; user can try resend
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[magic-link] Unexpected error:', err?.message);
    // Always return ok:true to avoid leaking any info
    return NextResponse.json({ ok: true });
  }
}