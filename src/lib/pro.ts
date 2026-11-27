import { sql } from '@/lib/db';

export const ASK_HOMIE_PRO_MONTHLY_LIMIT = 100;

let askHomieTablesReady = false;
async function ensureAskHomieTables(): Promise<void> {
  if (askHomieTablesReady) return;
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
  await sql`
    CREATE TABLE IF NOT EXISTS ask_homie_usage (
      user_fid INTEGER NOT NULL,
      period_start DATE NOT NULL,
      requests INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_fid, period_start)
    )
  `;
  askHomieTablesReady = true;
}

/** Check if a user has an active HomieHouse Pro subscription. */
export async function isProUser(userFid: number): Promise<boolean> {
  const rows = await sql`
    SELECT id FROM pro_subscribers
    WHERE user_fid = ${userFid}
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  `;
  return rows.length > 0;
}

/** Check if a user has the separate Ask Homie Pro add-on. */
export async function isAskHomieProUser(userFid: number): Promise<boolean> {
  await ensureAskHomieTables();
  const rows = await sql`
    SELECT id FROM ask_homie_pro_subscribers
    WHERE user_fid = ${userFid}
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  `;
  return rows.length > 0;
}

/** Atomically reserve one response from the current monthly allowance. */
export async function consumeAskHomieProRequest(
  userFid: number,
  monthlyLimit = ASK_HOMIE_PRO_MONTHLY_LIMIT,
): Promise<{ allowed: boolean; used: number }> {
  await ensureAskHomieTables();
  const rows = await sql`
    INSERT INTO ask_homie_usage (user_fid, period_start, requests)
    VALUES (${userFid}, date_trunc('month', NOW())::date, 1)
    ON CONFLICT (user_fid, period_start)
    DO UPDATE SET
      requests = ask_homie_usage.requests + 1,
      updated_at = NOW()
    WHERE ask_homie_usage.requests < ${monthlyLimit}
    RETURNING requests
  `;
  if (rows.length > 0) return { allowed: true, used: Number((rows[0] as any).requests) };

  const usage = await sql`
    SELECT requests FROM ask_homie_usage
    WHERE user_fid = ${userFid}
      AND period_start = date_trunc('month', NOW())::date
    LIMIT 1
  `;
  return { allowed: false, used: Number((usage[0] as any)?.requests ?? monthlyLimit) };
}

/** Return one reserved response when generation fails before a response is delivered. */
export async function releaseAskHomieProRequest(userFid: number): Promise<void> {
  await ensureAskHomieTables();
  await sql`
    UPDATE ask_homie_usage
    SET requests = GREATEST(requests - 1, 0),
        updated_at = NOW()
    WHERE user_fid = ${userFid}
      AND period_start = date_trunc('month', NOW())::date
  `;
}

/** Subscription and current-month usage for the signed-in account. */
export async function getAskHomieProStatus(userFid: number): Promise<{
  active: boolean;
  used: number;
  limit: number;
}> {
  await ensureAskHomieTables();
  const [subscriber, usage] = await Promise.all([
    sql`
      SELECT id FROM ask_homie_pro_subscribers
      WHERE user_fid = ${userFid}
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `,
    sql`
      SELECT requests FROM ask_homie_usage
      WHERE user_fid = ${userFid}
        AND period_start = date_trunc('month', NOW())::date
      LIMIT 1
    `,
  ]);
  return {
    active: subscriber.length > 0,
    used: Number((usage[0] as any)?.requests ?? 0),
    limit: ASK_HOMIE_PRO_MONTHLY_LIMIT,
  };
}
