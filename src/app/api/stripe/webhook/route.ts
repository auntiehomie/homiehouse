/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events for subscription lifecycle management.
 *
 * Events handled:
 * - checkout.session.completed → upsert pro_subscribers row
 * - customer.subscription.updated → update status/expiry
 * - customer.subscription.deleted → mark cancelled
 * - invoice.payment_succeeded → reactivate on renewal payment
 * - invoice.payment_failed → mark past_due
 *
 * This endpoint must be configured in the Stripe Dashboard as a webhook
 * endpoint pointing to: https://homiehouse.lol/api/stripe/webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripeOrThrow, upsertProSubscriber, updateSubscriptionStatus } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const stripe = getStripeOrThrow();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  // Read the raw body for signature verification
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error('[stripe/webhook] signature verification failed:', err?.message);
    return NextResponse.json({ error: `Webhook signature verification failed` }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ── Checkout completed → new subscription ──────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object;

        // Only handle subscription checkouts (not one-time payments)
        if (session.mode !== 'subscription') break;

        const fidStr = session.metadata?.fid;
        const fid = Number(fidStr);
        const customerId = typeof session.customer === 'string' ? session.customer : '';
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : '';

        if (!fidStr || isNaN(fid)) {
          console.error('[stripe/webhook] checkout.session.completed: no FID in metadata', session.id);
          break;
        }

        // Get the full subscription to find expiration
        let expiresAt: Date | null = null;
        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const periodEnd = (sub as any).current_period_end;
            if (periodEnd) {
              expiresAt = new Date(periodEnd * 1000);
            }
          } catch {
            // Non-fatal: we'll set expires_at to null (no expiration)
          }
        }

        await upsertProSubscriber({
          userFid: fid,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          status: 'active',
          expiresAt,
        });

        console.log(`[stripe/webhook] Pro subscription activated for FID ${fid}`);
        break;
      }

      // ── Subscription updated (renewal, pause, etc.) ─────────────────────────
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;

        let status = 'active';
        if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
          status = 'past_due';
        } else if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
          status = 'inactive';
        } else if (subscription.status === 'paused') {
          status = 'paused';
        }

        const periodEnd = (subscription as any).current_period_end;
        const expiresAt = periodEnd
          ? new Date(periodEnd * 1000)
          : null;

        await updateSubscriptionStatus(subscriptionId, status, expiresAt);
        console.log(`[stripe/webhook] Subscription ${subscriptionId} updated → ${status}`);
        break;
      }

      // ── Subscription deleted/cancelled ─────────────────────────────────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await updateSubscriptionStatus(subscription.id, 'cancelled', null);
        console.log(`[stripe/webhook] Subscription ${subscription.id} cancelled`);
        break;
      }

      // ── Invoice payment succeeded (renewal) ────────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;

        if (subscriptionId) {
          // Reactivate if previously past_due
          await updateSubscriptionStatus(subscriptionId, 'active');
          console.log(`[stripe/webhook] Invoice paid for subscription ${subscriptionId}`);
        }
        break;
      }

      // ── Invoice payment failed ─────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;

        if (subscriptionId) {
          await updateSubscriptionStatus(subscriptionId, 'past_due');
          console.log(`[stripe/webhook] Invoice payment failed for subscription ${subscriptionId}`);
        }
        break;
      }

      default:
        // Unhandled event type — no action needed
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[stripe/webhook] handler error:', err?.message ?? err);
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 });
  }
}