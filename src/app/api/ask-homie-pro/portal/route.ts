import { NextRequest, NextResponse } from 'next/server';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import { getAskHomieProSubscriber, getStripeOrThrow } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.app';

export async function POST(req: NextRequest) {
  try {
    const fid = await verifyFarcasterSignerAuth(req, 'write:shop');
    const subscriber = await getAskHomieProSubscriber(fid);
    if (!subscriber?.stripe_customer_id) {
      return NextResponse.json({ ok: false, error: 'No Ask Homie Pro card subscription found.' }, { status: 404 });
    }
    const portal = await getStripeOrThrow().billingPortal.sessions.create({
      customer: subscriber.stripe_customer_id,
      return_url: `${BASE_URL}/ask-homie`,
    });
    return NextResponse.json({ ok: true, url: portal.url });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to open subscription management.' },
      { status: err instanceof AuthError ? err.status : err?.statusCode || 500 },
    );
  }
}
