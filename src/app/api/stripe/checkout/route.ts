/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for the HomieHouse Pro subscription.
 * Requires Farcaster signer auth (x-farcaster-fid + x-signer-key headers).
 *
 * The client redirects to the returned URL for the Stripe-hosted checkout page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripeOrThrow, PRO_PRICE_ID } from '@/lib/stripe';
import { verifyFarcasterSignerAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

export async function POST(req: NextRequest) {
  try {
    // Verify the user is authenticated
    const fid = await verifyFarcasterSignerAuth(req);
    if (!fid) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    if (!PRO_PRICE_ID) {
      return NextResponse.json(
        { ok: false, error: 'Stripe price ID is not configured' },
        { status: 500 },
      );
    }

    const stripe = getStripeOrThrow();

    // Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRO_PRICE_ID,
          quantity: 1,
        },
      ],
      metadata: {
        fid: String(fid),
      },
      subscription_data: {
        metadata: {
          fid: String(fid),
        },
      },
      success_url: `${BASE_URL}/pro?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${BASE_URL}/pro?status=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_creation: 'always',
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error('[stripe/checkout] error:', err?.message ?? err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to create checkout session' },
      { status: err?.statusCode || 500 },
    );
  }
}