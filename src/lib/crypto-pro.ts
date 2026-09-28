/**
 * Crypto-native Pro subscription logic.
 *
 * Users pay 5 USDC/month on Base to a HomieHouse treasury address.
 * No Stripe, no KYC, no contract deployment — just verified on-chain transfers.
 *
 * Flow:
 * 1. User sends USDC to the treasury address on Base
 * 2. Frontend calls /api/pro/subscribe-crypto with the tx hash
 * 3. Backend verifies the tx (recipient, token, amount) via Base RPC
 * 4. If valid, upserts pro_subscribers with 30-day expiry
 * 5. isProUser() still works unchanged — reads from DB
 */

import { sql } from '@/lib/db';

// Base USDC (native, not bridged) — 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// HomieHouse Pro treasury — Amanda's treasury wallet on Base
export const PRO_TREASURY_ADDRESS = process.env.PRO_TREASURY_ADDRESS || '';

// Pro subscription price in USDC (6 decimals)
export const PRO_PRICE_USDC = 5_000_000n; // 5 USDC

// Subscription duration in days
export const PRO_DURATION_DAYS = 30;

// Base chain ID
export const BASE_CHAIN_ID = 8453;

/**
 * Verify a USDC transfer transaction on Base.
 * Checks: token address, recipient, amount, and that the tx was successful.
 */
export async function verifyUsdcTransfer(
  txHash: string,
  expectedRecipient: string,
  expectedAmount: bigint,
  rpcUrl: string
): Promise<{ valid: boolean; error?: string; sender?: string }> {
  try {
    // Fetch the transaction receipt
    const receiptResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      }),
    });

    const receiptData = await receiptResponse.json();
    const receipt = receiptData?.result;

    if (!receipt) {
      return { valid: false, error: 'Transaction not found' };
    }

    if (receipt.status !== '0x1') {
      return { valid: false, error: 'Transaction failed on-chain' };
    }

    // Look for USDC Transfer event in logs
    // Transfer(address indexed from, address indexed to, uint256 value)
    // Topic 0: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    let foundTransfer = false;
    let sender = '';

    for (const log of receipt.logs || []) {
      // Check if this is a USDC transfer (log address matches USDC contract)
      if (log.address?.toLowerCase() !== BASE_USDC_ADDRESS.toLowerCase()) continue;

      if (log.topics?.[0] !== transferTopic) continue;

      // Topic 1 = sender (padded to 32 bytes), Topic 2 = recipient
      const recipientFromLog = '0x' + (log.topics?.[2] || '').slice(-40);
      const amountHex = log.data;

      if (recipientFromLog.toLowerCase() !== expectedRecipient.toLowerCase()) continue;

      const amount = BigInt(amountHex || '0');

      if (amount >= expectedAmount) {
        foundTransfer = true;
        // Extract sender from topic 1
        sender = '0x' + (log.topics?.[1] || '').slice(-40);
        break;
      }
    }

    if (!foundTransfer) {
      return { valid: false, error: 'No matching USDC transfer found in transaction' };
    }

    return { valid: true, sender };
  } catch (err: any) {
    return { valid: false, error: `Verification failed: ${err?.message || 'unknown error'}` };
  }
}

/**
 * Record a crypto-based Pro subscription.
 * If the user already has an active subscription, extends it by PRO_DURATION_DAYS.
 */
export async function recordCryptoSubscription(
  userFid: number,
  walletAddress: string,
  txHash: string
): Promise<{ ok: boolean; expiresAt: Date; error?: string }> {
  try {
    // Check if this tx hash was already used (prevent replay)
    const existing = await sql`
      SELECT id FROM pro_subscribers
      WHERE stripe_subscription_id = ${txHash}
      AND status = 'active'
      LIMIT 1
    `;

    if (existing.length > 0) {
      return { ok: false, expiresAt: new Date(), error: 'This transaction was already claimed' };
    }

    // Check for existing active subscription to extend
    const current = await sql`
      SELECT id, expires_at FROM pro_subscribers
      WHERE user_fid = ${userFid}
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `;

    const now = new Date();
    const newExpiry = new Date(now.getTime() + PRO_DURATION_DAYS * 24 * 60 * 60 * 1000);

    if (current.length > 0) {
      // Extend existing subscription from its current expiry (or now if already expired)
      const currentExpiry = (current[0] as any).expires_at
        ? new Date((current[0] as any).expires_at)
        : now;
      const base = currentExpiry > now ? currentExpiry : now;
      const extendedExpiry = new Date(base.getTime() + PRO_DURATION_DAYS * 24 * 60 * 60 * 1000);

      await sql`
        UPDATE pro_subscribers
        SET expires_at = ${extendedExpiry},
            stripe_customer_id = ${walletAddress},
            stripe_subscription_id = ${txHash},
            updated_at = NOW()
        WHERE id = ${(current[0] as any).id}
      `;

      return { ok: true, expiresAt: extendedExpiry };
    }

    // Create new subscription
    await sql`
      INSERT INTO pro_subscribers (user_fid, status, subscribed_at, expires_at, stripe_customer_id, stripe_subscription_id)
      VALUES (${userFid}, 'active', NOW(), ${newExpiry}, ${walletAddress}, ${txHash})
      ON CONFLICT (user_fid) DO UPDATE
      SET status = 'active',
          subscribed_at = NOW(),
          expires_at = ${newExpiry},
          stripe_customer_id = ${walletAddress},
          stripe_subscription_id = ${txHash},
          updated_at = NOW()
    `;

    return { ok: true, expiresAt: newExpiry };
  } catch (err: any) {
    return { ok: false, expiresAt: new Date(), error: `DB error: ${err?.message || 'unknown'}` };
  }
}
