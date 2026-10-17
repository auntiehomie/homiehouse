/** Temporary visibility audit: no reputation filtering or personalized downranking. */
export const AUTOMATED_SPAM_FILTERING = false;
export const DEFAULT_MEMBER_FEED = 'following' as const;

export function unseenCastCount(current: Array<{ hash?: string; id?: string }>, next: Array<{ hash?: string; id?: string }>): number {
  const known = new Set(current.map(cast => cast.hash || cast.id).filter(Boolean));
  return new Set(next.map(cast => cast.hash || cast.id).filter((hash): hash is string => !!hash && !known.has(hash))).size;
}
