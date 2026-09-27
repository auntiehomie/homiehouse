/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session for managing an existing
 * subscription (cancel, update payment method, view invoices).
 * Requires Farcaster signer auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripeOrThrow, getProSubscriber } from '@/lib/stripe';
import { verifyFarcasterSignerAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

export async function POST(req: NextRequest) {
  try {
    const fid = await verifyFarcasterSignerAuth(req);
    if (!fid) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    // Look up the user's Stripe customer ID
    const sub = await getProSubscriber(fid);
    if (!sub || !sub.stripe_customer_id) {
      return NextResponse.json(
        { ok: false, error: 'No active subscription found' },
        { status: 404 },
      );
    }

    const stripe = getStripeOrThrow();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${BASE_URL}/pro`,
    });

    return NextResponse.json({
      ok: true,
      url: portalSession.url,
    });
  } catch (err: any) {
    console.error('[stripe/portal] error:', err?.message ?? err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to create portal session' },
      { status: err?.statusCode || 500 },
    );
  }
}