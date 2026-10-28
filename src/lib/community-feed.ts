import { hypersnapFetch } from '@/lib/hypersnap';
import { CommunityCast, rankCommunityCasts } from '@/lib/community-ranking';

// Best-effort bounded cache of public samples; no persistent reputation labels.
const cache = new Map<number, { casts: CommunityCast[]; expires: number }>();

const COMMUNITY_TRENDING_WINDOWS = new Set(['1h', '6h', '12h', '24h', '7d']);

function communitySignerFids(envName: string): string | undefined {
  const raw = process.env[envName]?.trim();
  if (!raw) return undefined;
  const fids = [...new Set(raw.split(',').map((value) => value.trim()))];
  if (fids.length > 100 || fids.some((fid) => !/^[1-9]\d*$/.test(fid))) {
    throw new Error(`${envName} must be a comma-separated list of up to 100 positive app FIDs`);
  }
  return fids.join(',');
}

/**
 * Optional Hypersnap trending controls for Community. Signer FIDs identify the
 * publishing client app, not the cast author. Empty lists preserve normal
 * Hypersnap trending behavior.
 */
export function getCommunityTrendingParams() {
  // Hypersnap's trending route supports up to a seven-day window. Use that
  // broadest documented window by default; members can still narrow it via env.
  const configuredWindow = process.env.HOMIEHOUSE_COMMUNITY_TRENDING_WINDOW?.trim();
  const time_window = configuredWindow || '7d';
  if (!COMMUNITY_TRENDING_WINDOWS.has(time_window)) {
    throw new Error('HOMIEHOUSE_COMMUNITY_TRENDING_WINDOW must be one of 1h, 6h, 12h, 24h, or 7d');
  }
  const include_signer_fids = communitySignerFids('HOMIEHOUSE_COMMUNITY_INCLUDE_SIGNER_FIDS');
  const exclude_signer_fids = communitySignerFids('HOMIEHOUSE_COMMUNITY_EXCLUDE_SIGNER_FIDS');
  return {
    time_window,
    ...(include_signer_fids ? { include_signer_fids } : {}),
    ...(exclude_signer_fids ? { exclude_signer_fids } : {}),
  };
}

export async function rankCommunityPage<T extends CommunityCast>(casts: T[]) {
  const histories = new Map<number, CommunityCast[]>();
  const pending = [...new Set(casts.map(c => c.author?.fid).filter((fid): fid is number => Number.isSafeInteger(fid) && Number(fid) > 0))];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(6, pending.length) }, async () => {
    while (next < pending.length) {
      const fid = pending[next++];
      const hit = cache.get(fid);
      if (hit && hit.expires > Date.now()) { histories.set(fid, hit.casts); continue; }
      try {
        // Sample the latest 50; do not walk a user's entire history on a feed request.
        const data = await hypersnapFetch(`/v2/farcaster/feed/user/casts?fid=${fid}&limit=50`, {}, 1500);
        if (!Array.isArray(data?.casts)) continue;
        const sample = data.casts.slice(0, 50);
        histories.set(fid, sample);
        cache.delete(fid);
        cache.set(fid, { casts: sample, expires: Date.now() + 15 * 60_000 });
        if (cache.size > 500) cache.delete(cache.keys().next().value!);
      } catch { /* Missing history is neutral; the candidate casts remain visible. */ }
    }
  }));
  return rankCommunityCasts(casts, histories);
}
