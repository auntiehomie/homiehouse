/**
 * Read-only HH2 token statistics.
 *
 * Pure aggregation helpers for the public token dashboard. Nothing here moves
 * tokens or changes balances. All values are aggregates; no FIDs, wallets, or
 * per-user rows are exposed.
 *
 * Accounting labels matter: shop "burns" are LEDGER entries only (they do not
 * reduce on-chain supply). Only `wallet-burn` rows with a tx_hash are on-chain
 * transfers to the dead address. The labels below keep the two apart.
 */

export interface RawTokenStats {
  /** Sum of hh2_reward_events.amount (all statuses). */
  totalEarned: number | string | null;
  /** Sum of hh2_reward_events.amount where status = 'claimed'. */
  totalClaimedToWallet: number | string | null;
  /** Sum of hh2_reward_events.amount earned in the last 24h. */
  earnedLast24h: number | string | null;
  /** Ledger burn totals grouped by reason. */
  burnsByReason: Array<{ reason: string; total: number | string | null }>;
  /** Sum of on-chain-confirmed staked HH2 (status = 'active', tx_hash not null). */
  stakedOnChain: number | string | null;
}

export interface Hh2TokenStats {
  generatedAt: string;
  units: 'HH2 (whole tokens)';
  emission: {
    totalEarnedInApp: number;
    claimedToWallet: number;
    earnedLast24h: number;
    note: string;
  };
  burns: {
    ledgerShopBurns: number;
    onChainWalletBurns: number;
    note: string;
  };
  staking: {
    stakedOnChain: number;
    note: string;
  };
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function buildTokenStats(raw: RawTokenStats, now: Date = new Date()): Hh2TokenStats {
  const burnTotals = raw.burnsByReason.reduce(
    (acc, row) => {
      const amount = toNumber(row.total);
      if (row.reason === 'wallet-burn') acc.onChain += amount;
      else acc.ledger += amount;
      return acc;
    },
    { ledger: 0, onChain: 0 },
  );

  return {
    generatedAt: now.toISOString(),
    units: 'HH2 (whole tokens)',
    emission: {
      totalEarnedInApp: toNumber(raw.totalEarned),
      claimedToWallet: toNumber(raw.totalClaimedToWallet),
      earnedLast24h: toNumber(raw.earnedLast24h),
      note: 'App-earned HH2 is recorded in the database. Only the claimed portion is transferred on-chain from the treasury.',
    },
    burns: {
      ledgerShopBurns: burnTotals.ledger,
      onChainWalletBurns: burnTotals.onChain,
      note: 'Shop burns are ledger entries and do not reduce on-chain supply. On-chain burns are user-initiated transfers to 0x…dEaD.',
    },
    staking: {
      stakedOnChain: toNumber(raw.stakedOnChain),
      note: 'Counts only stakes confirmed on-chain. Legacy database-only stakes are excluded.',
    },
  };
}
