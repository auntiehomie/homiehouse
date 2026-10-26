import { NextRequest, NextResponse } from 'next/server';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import { ASK_HOMIE_PRO_PRICE_ID, getStripeOrThrow, getAskHomieProSubscriber } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.app';

export async function POST(req: NextRequest) {
  try {
    const fid = await verifyFarcasterSignerAuth(req, 'write:shop');
    if (!ASK_HOMIE_PRO_PRICE_ID) {
      return NextResponse.json({ ok: false, error: 'Ask Homie Pro Stripe price is not configured.' }, { status: 503 });
    }
    const existing = await getAskHomieProSubscriber(fid);
    if (existing?.status === 'active' && (!existing.expires_at || new Date(existing.expires_at).getTime() > Date.now())) {
      return NextResponse.json({ ok: false, error: 'Ask Homie Pro is already active on this account.' }, { status: 409 });
    }

    const stripe = getStripeOrThrow();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: ASK_HOMIE_PRO_PRICE_ID, quantity: 1 }],
      metadata: { fid: String(fid), product: 'ask_homie_pro' },
      subscription_data: { metadata: { fid: String(fid), product: 'ask_homie_pro' } },
      success_url: `${BASE_URL}/ask-homie?ask_homie_pro=success`,
      cancel_url: `${BASE_URL}/ask-homie?ask_homie_pro=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to create Ask Homie Pro checkout.' },
      { status: err instanceof AuthError ? err.status : err?.statusCode || 500 },
    );
  }
}
