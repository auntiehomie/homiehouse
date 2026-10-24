export interface OptimisticCast {
  hash: string;
  text: string;
  timestamp: number;
  author: {
    fid: number;
    username?: string;
    display_name?: string;
    pfp_url?: string;
  };
  embeds?: { url: string }[];
  parent_hash?: string;
  parent_author?: { fid: number };
  channel?: { id: string };
  optimistic: true;
}

const STORAGE_PREFIX = 'hh_pending_casts_v1:';
const OPTIMISTIC_CAST_EVENT = 'hh:cast:optimistic';
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PENDING_CASTS = 30;

function storageKey(fid: number): string {
  return `${STORAGE_PREFIX}${fid}`;
}

function readStoredCasts(fid: number): OptimisticCast[] {
  if (typeof window === 'undefined' || !fid) return [];

  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey(fid)) || '[]');
    if (!Array.isArray(stored)) return [];
    const pending = stored.filter((cast): cast is OptimisticCast =>
      cast?.optimistic === true &&
      typeof cast.hash === 'string' &&
      typeof cast.text === 'string' &&
      Number.isFinite(cast.timestamp) &&
      Date.now() - cast.timestamp < PENDING_TTL_MS &&
      Number(cast.author?.fid) === fid,
    ).slice(0, MAX_PENDING_CASTS);
    sessionStorage.setItem(storageKey(fid), JSON.stringify(pending));
    return pending;
  } catch {
    return [];
  }
}

function writeStoredCasts(fid: number, casts: OptimisticCast[]) {
  if (typeof window === 'undefined' || !fid) return;
  try {
    sessionStorage.setItem(storageKey(fid), JSON.stringify(casts.slice(0, MAX_PENDING_CASTS)));
  } catch {
    // The in-tab event still updates the current feed if storage is unavailable.
  }
}

export function getPendingOptimisticCasts(fid: number): OptimisticCast[] {
  return readStoredCasts(fid);
}

export function publishOptimisticCast(cast: OptimisticCast) {
  if (typeof window === 'undefined' || !cast.author.fid || !cast.hash) return;
  const pending = readStoredCasts(cast.author.fid).filter(item => item.hash !== cast.hash);
  writeStoredCasts(cast.author.fid, [cast, ...pending]);
  window.dispatchEvent(new CustomEvent(OPTIMISTIC_CAST_EVENT, { detail: cast }));
}

export function reconcileOptimisticCasts(fid: number, canonicalCasts: unknown[]): OptimisticCast[] {
  const confirmedHashes = new Set(
    canonicalCasts
      .map((cast: any) => cast?.hash || cast?.id)
      .filter((hash): hash is string => typeof hash === 'string' && hash.length > 0)
      .map(hash => hash.toLowerCase()),
  );
  const remaining = readStoredCasts(fid).filter(cast => !confirmedHashes.has(cast.hash.toLowerCase()));
  writeStoredCasts(fid, remaining);
  return remaining;
}

export function listenForOptimisticCasts(
  fid: number,
  onCast: (cast: OptimisticCast) => void,
): () => void {
  if (typeof window === 'undefined' || !fid) return () => {};

  const handleEvent = (event: Event) => {
    const cast = (event as CustomEvent<OptimisticCast>).detail;
    if (cast?.optimistic === true && Number(cast.author?.fid) === fid) onCast(cast);
  };
  window.addEventListener(OPTIMISTIC_CAST_EVENT, handleEvent);
  return () => {
    window.removeEventListener(OPTIMISTIC_CAST_EVENT, handleEvent);
  };
}
