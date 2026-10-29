import { loadRecentInteractions, type RecentInteraction } from './recent-interactions';

interface Cast {
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
export function rankByLikes<T extends Cast>(casts: T[], interactions: RecentInteraction[], now = Date.now()): T[] {
  const samples = interactions.filter(item => (item.type === 'like' || item.type === 'more' || item.type === 'less')
    && Number.isFinite(Date.parse(item.reactedAt))
    && Date.parse(item.reactedAt) <= now
    && now - Date.parse(item.reactedAt) < 90 * 86400000);
  if (!samples.length) return casts;
  const seen = new Set<string>();
  const profile = samples.filter(item => {
    if (seen.has(item.castHash)) return false;
    seen.add(item.castHash); return true;
  }).map(item => ({ item, words: terms(item.text), weight: Math.exp(-(now - Date.parse(item.reactedAt)) / (30 * 86400000)) * (item.type === 'less' ? -1 : 1) }));
  const scored = casts.map((cast, index) => {
    const words = terms(cast.text);
    let score = 0;
    for (const sample of profile) {
      const overlap = [...words].filter(word => sample.words.has(word)).length;
      // Topic overlap matters more than author affinity; repeated likes saturate.
      const topic = overlap / Math.sqrt(Math.max(1, words.size * sample.words.size));
      score += sample.weight * (topic + (cast.author?.fid && cast.author.fid === sample.item.authorFid ? 0.45 : 0)
        + (cast.channel?.id && cast.channel.id === sample.item.channelId ? 0.1 : 0));
    }
    return { cast, index, score };
  });
  const remaining = scored.slice().sort((a, b) => b.score - a.score || a.index - b.index);
  const output: T[] = [];
  const authors = new Map<number, number>();
  while (remaining.length) {
    // One in five slots preserves discovery from the original candidate order.
    const discovery = output.length % 5 === 4;
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
  return rankByLikes(casts, loadRecentInteractions(preferenceStorage(fid)));
}
