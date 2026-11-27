/**
 * Stripe client singleton and shared utilities.
 *
 * Initializes the Stripe SDK with the secret key and provides
 * helper functions for subscription management used by both
 * the checkout/portal API routes and the webhook handler.
 */

import Stripe from 'stripe';
import { sql } from './db';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Let the installed Stripe SDK use its supported default API version.
  // Hard-coding an unsupported version makes every Stripe request fail.
  return new Stripe(key);
}

export function getStripeOrThrow(): Stripe {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return stripe;
}

const STRIPE_PRICE_ID = process.env.STRIPE_PRO_MONTHLY_PRICE_ID!;

export const PRO_PRICE_ID = STRIPE_PRICE_ID;
export const ASK_HOMIE_PRO_PRICE_ID = process.env.STRIPE_ASK_HOMIE_PRO_MONTHLY_PRICE_ID!;

// ── Database helpers ──────────────────────────────────────────────────────────

export interface ProSubscriber {
  id: string;
  user_fid: number;
  status: string;
  subscribed_at: string;
  expires_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

/**
 * Upsert a pro subscriber record. Creates or updates based on stripe_customer_id
 * or user_fid match.
 */
export async function upsertProSubscriber(params: {
  userFid: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status?: string;
  expiresAt?: Date | null;
}): Promise<void> {
  const { userFid, stripeCustomerId, stripeSubscriptionId, status = 'active', expiresAt = null } = params;

  await sql`
    INSERT INTO pro_subscribers
      (user_fid, status, stripe_customer_id, stripe_subscription_id, subscribed_at, expires_at)
    VALUES (${userFid}, ${status}, ${stripeCustomerId}, ${stripeSubscriptionId}, NOW(), ${expiresAt ?? null})
    ON CONFLICT (user_fid)
    DO UPDATE SET
      status = EXCLUDED.status,
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
  `;
}

/**
 * Update subscription status by Stripe subscription ID.
 */
let askHomieSubscriptionTableReady = false;
async function ensureAskHomieSubscriptionTable(): Promise<void> {
  if (askHomieSubscriptionTableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS ask_homie_pro_subscribers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_fid INTEGER UNIQUE NOT NULL,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  askHomieSubscriptionTableReady = true;
}

export async function updateSubscriptionStatus(
  stripeSubscriptionId: string,
  status: string,
  expiresAt?: Date | null,
): Promise<void> {
  await sql`
    UPDATE pro_subscribers
    SET status = ${status},
        expires_at = ${expiresAt ?? null},
        updated_at = NOW()
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
  `;
  await ensureAskHomieSubscriptionTable();
  await sql`
    UPDATE ask_homie_pro_subscribers
    SET status = ${status},
        expires_at = ${expiresAt ?? null},
        updated_at = NOW()
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
  `;
}

export async function upsertAskHomieProSubscriber(params: {
  userFid: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status?: string;
  expiresAt?: Date | null;
}): Promise<void> {
  await ensureAskHomieSubscriptionTable();
  const { userFid, stripeCustomerId, stripeSubscriptionId, status = 'active', expiresAt = null } = params;
  await sql`
    INSERT INTO ask_homie_pro_subscribers
      (user_fid, status, stripe_customer_id, stripe_subscription_id, subscribed_at, expires_at)
    VALUES (${userFid}, ${status}, ${stripeCustomerId}, ${stripeSubscriptionId}, NOW(), ${expiresAt ?? null})
    ON CONFLICT (user_fid)
    DO UPDATE SET
      status = EXCLUDED.status,
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
  `;
}

/** Look up an Ask Homie Pro subscriber by FID. */
export async function getAskHomieProSubscriber(userFid: number) {
  await ensureAskHomieSubscriptionTable();
  const rows = await sql`
    SELECT id, user_fid, status, subscribed_at, expires_at,
           stripe_customer_id, stripe_subscription_id
    FROM ask_homie_pro_subscribers
    WHERE user_fid = ${userFid}
    LIMIT 1
  `;
  return rows.length ? rows[0] as any : null;
}

/**
 * Look up a pro subscriber by FID.
 */
export async function getProSubscriber(userFid: number): Promise<ProSubscriber | null> {
  const rows = await sql`
    SELECT id, user_fid, status, subscribed_at, expires_at,
           stripe_customer_id, stripe_subscription_id
    FROM pro_subscribers
    WHERE user_fid = ${userFid}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const row = rows[0] as any;
  return {
    id: row.id,
    user_fid: row.user_fid,
    status: row.status,
    subscribed_at: row.subscribed_at,
    expires_at: row.expires_at,
    stripe_customer_id: row.stripe_customer_id,
    stripe_subscription_id: row.stripe_subscription_id,
  };
}