import { buildTokenStats, type RawTokenStats } from '@/lib/hh2-token-stats';

const NOW = new Date('2026-10-13T14:00:00Z');

describe('buildTokenStats', () => {
  it('returns zeros for an empty database', () => {
    const raw: RawTokenStats = {
      totalEarned: null,
      totalClaimedToWallet: null,
      earnedLast24h: null,
      burnsByReason: [],
      stakedOnChain: null,
    };
    const stats = buildTokenStats(raw, NOW);
    expect(stats.emission.totalEarnedInApp).toBe(0);
    expect(stats.burns.ledgerShopBurns).toBe(0);
    expect(stats.burns.onChainWalletBurns).toBe(0);
    expect(stats.staking.stakedOnChain).toBe(0);
    expect(stats.generatedAt).toBe(NOW.toISOString());
  });

  it('parses Postgres NUMERIC strings and keeps ledger and on-chain burns separate', () => {
    const raw: RawTokenStats = {
      totalEarned: '12500',
      totalClaimedToWallet: '4000.000000000000000000',
      earnedLast24h: '250',
      burnsByReason: [
        { reason: 'shop-purchase-burn', total: '300.000000000000000000' },
        { reason: 'wallet-burn', total: '42.5' },
      ],
      stakedOnChain: '1000',
    };
    const stats = buildTokenStats(raw, NOW);
    expect(stats.emission).toMatchObject({ totalEarnedInApp: 12500, claimedToWallet: 4000, earnedLast24h: 250 });
    expect(stats.burns.ledgerShopBurns).toBe(300);
    expect(stats.burns.onChainWalletBurns).toBe(42.5);
    expect(stats.staking.stakedOnChain).toBe(1000);
  });

  it('treats malformed or negative values as zero', () => {
    const raw: RawTokenStats = {
      totalEarned: 'not-a-number',
      totalClaimedToWallet: -5,
      earnedLast24h: '',
      burnsByReason: [{ reason: 'shop-purchase-burn', total: NaN as unknown as number }],
      stakedOnChain: '0',
    };
    const stats = buildTokenStats(raw, NOW);
    expect(stats.emission.totalEarnedInApp).toBe(0);
    expect(stats.emission.claimedToWallet).toBe(0);
    expect(stats.burns.ledgerShopBurns).toBe(0);
  });

  it('never exposes per-user fields', () => {
    const stats = buildTokenStats(
      { totalEarned: '1', totalClaimedToWallet: '0', earnedLast24h: '0', burnsByReason: [], stakedOnChain: '0' },
      NOW,
    );
    expect(JSON.stringify(stats)).not.toMatch(/fid|wallet_address|address/i);
  });
});
