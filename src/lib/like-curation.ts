import { loadRecentInteractions, type RecentInteraction } from './recent-interactions';

export interface Cast {
  hash?: string;
  text?: string;
  author?: { fid?: number };
  channel?: { id?: string };
}
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Keep learned preferences separate for each signed-in account on this device. */
export function preferenceStorage(fid: unknown): StorageLike | null {
  if (!Number.isSafeInteger(Number(fid)) || Number(fid) <= 0 || typeof window === 'undefined') return null;
  return {
    getItem: key => window.localStorage.getItem(key + ':' + fid),
    setItem: (key, value) => window.localStorage.setItem(key + ':' + fid, value),
  };
}

const STOP = new Set('this that with from have your about there their they them what when where would could should into just like more some been were will also than then'.split(' '));
function terms(text = ''): Set<string> {
  return new Set(text.normalize('NFKC').toLowerCase().replace(/https?:\/\/\S+|@\S+/gu, ' ').match(/[\p{L}\p{N}]{3,}/gu)?.filter(word => !STOP.has(word)) || []);
}

/** Rerank only the newly loaded page: keep existing scroll positions and all candidates. */
export function rankByLikes<T extends Cast>(casts: T[], interactions: RecentInteraction[], now = Date.now(), tuning: FeedTuning = defaultTuning()): T[] {
  const samples = interactions.filter(item => item.type === 'like'
    && Number.isFinite(Date.parse(item.reactedAt))
    && Date.parse(item.reactedAt) <= now
    && now - Date.parse(item.reactedAt) < 90 * 86400000);
  if (!samples.length && !tuning.feedback.length) return casts;
  const seen = new Set<string>();
  const profile = samples.filter(item => {
    if (seen.has(item.castHash)) return false;
    seen.add(item.castHash); return true;
  }).map(item => ({ item, words: terms(item.text), weight: Math.exp(-(now - Date.parse(item.reactedAt)) / (30 * 86400000)) }));
  const feedback = tuning.feedback.map(sample => ({ ...sample, words: terms(sample.text) }));
  const discoveryInterval = tuning.discovery === 'explore' ? 2 : tuning.discovery === 'focused' ? 10 : 5;
  const scored = casts.map((cast, index) => {
    const words = terms(cast.text);
    let score = 0;
    for (const sample of profile) {
      const overlap = [...words].filter(word => sample.words.has(word)).length;
      // Topic overlap matters more than author affinity; repeated likes saturate.
      const topic = overlap / Math.sqrt(Math.max(1, words.size * sample.words.size));
      score += sample.weight * (topic + (cast.author?.fid && cast.author.fid === sample.item.authorFid ? 0.15 : 0)
        + (cast.channel?.id && cast.channel.id === sample.item.channelId ? 0.1 : 0));
    }
    score = Math.min(1, score);
    for (const sample of feedback) {
      const sampleWords = sample.words;
      const overlap = [...words].filter(word => sampleWords.has(word)).length;
      score += sample.direction * (overlap / Math.sqrt(Math.max(1, words.size * sampleWords.size))
        + (cast.author?.fid && cast.author.fid === sample.authorFid ? 0.15 : 0));
    }
    return { cast, index, score };
  });
  const remaining = scored.slice().sort((a, b) => b.score - a.score || a.index - b.index);
  const output: T[] = [];
  const authors = new Map<number, number>();
  while (remaining.length) {
    // Preserve original candidate order in a user-selected share of slots.
    const discovery = output.length % discoveryInterval === discoveryInterval - 1;
    const eligible = remaining.filter(entry => !entry.cast.author?.fid || (authors.get(entry.cast.author.fid) || 0) < 2);
    const pool = eligible.length ? eligible : remaining;
    const pick = discovery ? pool.reduce((a, b) => a.index < b.index ? a : b) : pool[0];
    remaining.splice(remaining.indexOf(pick), 1);
    output.push(pick.cast);
    const fid = pick.cast.author?.fid;
    if (fid) authors.set(fid, (authors.get(fid) || 0) + 1);
  }
  return output;
}

export function personalizePage<T extends Cast>(casts: T[], fid: unknown): T[] {
  return rankByLikes(casts, loadRecentInteractions(preferenceStorage(fid)), Date.now(), loadFeedTuning(fid));
}

export type Discovery = 'focused' | 'balanced' | 'explore';
export interface FeedTuning {
  discovery: Discovery;
  feedback: { hash: string; text: string; authorFid: number; direction: 1 | -1 }[];
}
export const defaultTuning = (): FeedTuning => ({ discovery: 'balanced', feedback: [] });
export function loadFeedTuning(fid: unknown): FeedTuning {
  try {
    const value = JSON.parse(preferenceStorage(fid)?.getItem('hh_feed_tuning_v1') || 'null');
    if (!value || !['focused', 'balanced', 'explore'].includes(value.discovery) || !Array.isArray(value.feedback)) return defaultTuning();
    return { discovery: value.discovery, feedback: value.feedback.filter((x: FeedTuning['feedback'][number]) =>
      x && typeof x.hash === 'string' && typeof x.text === 'string' && Number.isSafeInteger(x.authorFid) && [1, -1].includes(x.direction)
    ).slice(0, 50) };
  } catch { return defaultTuning(); }
}
export function saveFeedTuning(fid: unknown, tuning: FeedTuning): boolean {
  try {
    const storage = preferenceStorage(fid);
    if (!storage) return false;
    storage.setItem('hh_feed_tuning_v1', JSON.stringify(tuning));
    return true;
  } catch { return false; }
}
export function recordFeedFeedback(fid: unknown, cast: Cast, direction: 1 | -1): boolean {
  if (!cast.hash) return false;
  const tuning = loadFeedTuning(fid);
  tuning.feedback = [{ hash: cast.hash, text: (cast.text || '').slice(0, 1000), authorFid: cast.author?.fid || 0, direction },
    ...tuning.feedback.filter(x => x.hash !== cast.hash)].slice(0, 50);
  return saveFeedTuning(fid, tuning);
}
