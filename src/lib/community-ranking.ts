/** Transparent, page-local experiment. These signals do not establish authenticity. */
export interface CommunityCast {
  hash?: string;
  text?: string;
  timestamp?: string | number;
  author?: { fid?: number; follower_count?: number };
  parent_hash?: string | null;
  embeds?: unknown[];
  reactions?: { likes_count?: number; recasts_count?: number };
  replies?: { count?: number };
}

export const COMMUNITY_WEIGHTS = { context: 0.30, engagement: 0.25, participation: 0.20, freshness: 0.15, history: 0.10 };
const DAY = 86_400_000;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const count = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0;
function time(value: unknown, now: number): number | null {
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value)
    : typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(ms) && ms > 0 && ms <= now ? ms : null;
}
function normalized(text?: string) {
  return (text || '').normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
}

export function rankCommunityCasts<T extends CommunityCast>(casts: T[], histories: Map<number, CommunityCast[]>, now = Date.now()) {
  const scored = casts.map((cast, index) => {
    const fid = cast.author?.fid;
    // Only use the author's own, distinct, identifiable casts; exclude malformed dates.
    const seen = new Set<string>();
    const sample = (fid ? histories.get(fid) || [] : []).filter(c => {
      if (c.author?.fid !== fid || !c.hash || seen.has(c.hash) || time(c.timestamp, now) === null) return false;
      seen.add(c.hash); return true;
    });
    const dates = sample.map(c => time(c.timestamp, now)!);
    const oldest = dates.length ? Math.min(...dates) : null;
    const spanDays = dates.length ? (Math.max(...dates) - Math.min(...dates)) / DAY : 0;
    const activeWeeks = new Set(dates.map(d => Math.floor(d / (7 * DAY)))).size;
    const texts = sample.map(c => normalized(c.text)).filter(Boolean);
    const uniqueRatio = texts.length ? new Set(texts).size / texts.length : 0.5;
    const sufficientHistory = sample.length >= 3;
    const participation = sufficientHistory ? 0.5 * uniqueRatio + 0.5 * clamp(activeWeeks / 8) : 0.5;
    // A lower bound on observed activity, not registration age or first-ever cast.
    const history = sufficientHistory ? clamp(Math.log1p(spanDays) / Math.log1p(365)) : 0.5;
    const published = time(cast.timestamp, now);
    const freshness = published === null ? 0.5 : Math.exp(-(now - published) / (3 * DAY));
    // Capped aggregate counts are weak evidence. They cannot identify reply quality or rings.
    const activity = count(cast.reactions?.likes_count) + 2 * count(cast.reactions?.recasts_count) + 2 * count(cast.replies?.count);
    const followers = count(cast.author?.follower_count);
    const engagement = clamp(Math.log1p(activity) / Math.log1p(Math.max(10, followers * 0.1)));
    // Small context bonuses, no grammar, length, language, sentiment or AI-detector score.
    const context = Math.min(1, 0.5 + (cast.parent_hash ? 0.25 : 0) + (cast.embeds?.length ? 0.25 : 0));
    const components = { context, engagement, participation, freshness, history };
    const score = Object.entries(COMMUNITY_WEIGHTS).reduce((sum, [key, weight]) => sum + components[key as keyof typeof components] * weight, 0);
    const reasons = ['Community experiment: ranked within this Hypersnap page'];
    if (sufficientHistory) reasons.push(`${sample.length} sampled casts across ${activeWeeks} active weeks; earliest observed ${new Date(oldest!).toISOString().slice(0, 10)}`);
    else reasons.push('Limited casting history; neutral history and participation scores');
    if (engagement >= 0.5) reasons.push('Engagement relative to reported audience size (aggregate counts)');
    if (context > 0.5) reasons.push('Includes reply context or an attachment; accuracy is not verified');
    return { cast: { ...cast, community_ranking: { version: 'community-v1', score, components, reasons, sampleSize: sample.length, earliestObserved: oldest === null ? null : new Date(oldest).toISOString(), exploration: false } }, index };
  }).sort((a, b) => b.cast.community_ranking.score - a.cast.community_ranking.score || a.index - b.index);

  // Every fifth slot gives a lower-engagement account a chance. Never remove a cast.
  const output: typeof scored = [];
  const authors = new Map<number, number>();
  while (scored.length) {
    const discoverySlot = output.length % 5 === 4;
    let pick = discoverySlot ? scored.findIndex(({ cast }) => cast.community_ranking.components.engagement < 0.5 && !authors.has(cast.author?.fid || 0)) : -1;
    const exploration = pick >= 0;
    // Spread authors through the page while alternatives remain available.
    if (pick < 0) pick = scored.findIndex(({ cast }) => (authors.get(cast.author?.fid || 0) || 0) < 2);
    if (pick < 0) pick = 0;
    const [entry] = scored.splice(pick, 1);
    if (exploration) {
      entry.cast.community_ranking.exploration = true;
      entry.cast.community_ranking.reasons.push('Discovery space for a less-engaged author in this page');
    }
    const fid = entry.cast.author?.fid;
    if (fid) authors.set(fid, (authors.get(fid) || 0) + 1);
    output.push(entry);
  }
  return output.map(entry => entry.cast);
}
