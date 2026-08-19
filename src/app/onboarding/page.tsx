/**
 * Onboarding — Landing page after email verification.
 *
 * Server component that checks the hh_session cookie for a valid JWT.
 * Redirects to / if not authenticated.
 *
 * Shows a welcome screen with "Are you new to Farcaster?" choice:
 *  - "I'm new" → profile setup
 *  - "I have Farcaster" → connect existing account
 */

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';
import type { Metadata } from 'next';
import OnboardingClient from './client';

export const metadata: Metadata = {
  title: 'Onboarding — HomieHouse',
};

interface SessionPayload {
  userId: number;
  email: string;
  sub: string;
}

async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('hh_session')?.value;
    if (!token) return null;

    const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
    if (!secret) return null;

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );

    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export default async function OnboardingPage() {
  const session = await getSession();

  if (!session) {
    redirect('/');
  }

  // Use the search params or query string to see if there's a 'step' or anything
  return (
    <OnboardingClient
      userId={session.userId}
      email={session.email}
    />
  );
}