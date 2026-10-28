/**
 * Shared display formatters for token prices, market caps and wallet addresses.
 * Extracted from duplicate copies in the token pages and wallet pages.
 */

/** Format a token price, using more decimals for small values. */
export function fmtPrice(p?: number): string {
  if (p == null) return '—';
  if (p < 0.000001) return `$${p.toExponential(2)}`;
  if (p < 0.01) return `$${p.toFixed(6)}`;
  if (p < 1) return `$${p.toFixed(4)}`;
  return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/** Format a large USD amount as B / M / K. */
export function fmtLarge(n?: number): string {
  if (n == null) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

/** Shorten a wallet address to `0x1234…abcd`. */
export function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
