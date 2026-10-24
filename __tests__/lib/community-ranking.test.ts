import { CommunityCast, rankCommunityCasts } from '@/lib/community-ranking';

const now = Date.parse('2026-10-19T12:00:00Z');
const day = 86_400_000;
const cast = (hash: string, fid: number, extra: Partial<CommunityCast> = {}): CommunityCast => ({ hash, author: { fid }, text: 'hello', timestamp: now - day, ...extra });
const history = (fid: number, repeated = false) => Array.from({ length: 8 }, (_, i) => cast(`h${fid}-${i}`, fid, { timestamp: now - i * 30 * day, text: repeated ? 'same promotion' : `different conversation ${i}` }));

it('rewards observed sustained, varied participation without using FID age', () => {
  const ranked = rankCommunityCasts([cast('old-id', 1), cast('active', 9000)], new Map([[9000, history(9000)]]), now);
  expect(ranked[0].hash).toBe('active');
  expect(ranked[1].community_ranking.components.history).toBe(0.5);
});
it('caps history and engagement, keeps unknowns neutral, and handles malformed numbers', () => {
  const result = rankCommunityCasts([cast('bad', 1, { timestamp: 'invalid', author: { fid: 1, follower_count: NaN }, reactions: { likes_count: Infinity, recasts_count: -10 } })], new Map(), now)[0];
  expect(result.community_ranking.components).toMatchObject({ history: 0.5, participation: 0.5, freshness: 0.5, engagement: 0 });
  expect(Number.isFinite(result.community_ranking.score)).toBe(true);
});
it('ignores duplicates, future timestamps, and other authors in history', () => {
  const bad = [cast('same', 1), cast('same', 1), cast('wrong', 2), cast('future', 1, { timestamp: now + day })];
  const result = rankCommunityCasts([cast('candidate', 1)], new Map([[1, bad]]), now)[0];
  expect(result.community_ranking.sampleSize).toBe(1);
  expect(result.community_ranking.components.history).toBe(0.5);
});
it('repeated text weakens the participation signal without removing casts', () => {
  const result = rankCommunityCasts([cast('repeat', 1), cast('varied', 2)], new Map([[1, history(1, true)], [2, history(2)]]), now);
  expect(result[0].hash).toBe('varied');
  expect(result).toHaveLength(2);
});
it('reserves the fifth position for a less-engaged author and preserves every candidate', () => {
  const candidates = [...Array.from({ length: 8 }, (_, i) => cast(`popular${i}`, i + 1, { reactions: { likes_count: 100 } })), cast('overlooked', 99)];
  const result = rankCommunityCasts(candidates, new Map(), now);
  expect(result[4].hash).toBe('overlooked');
  expect(result[4].community_ranking.exploration).toBe(true);
  expect(result.map(c => c.hash).sort()).toEqual(candidates.map(c => c.hash).sort());
  expect(candidates[0]).not.toHaveProperty('community_ranking');
});
it('spreads prolific authors without dropping their casts and remains deterministic', () => {
  const input = [cast('a', 1), cast('b', 1), cast('c', 1), cast('d', 2)];
  const result = rankCommunityCasts(input, new Map(), now);
  expect(result.map(c => c.hash)).toEqual(['a', 'b', 'd', 'c']);
  expect(rankCommunityCasts(input, new Map(), now)).toEqual(result);
});
it('does not use writing length, language, grammar or account identifiers as quality signals', () => {
  const input = [cast('a', 1, { text: 'hi' }), cast('b', 500, { text: 'a long post '.repeat(100) }), cast('c', 999, { text: '你好 👋' })];
  const result = rankCommunityCasts(input, new Map(), now);
  expect(new Set(result.map(c => c.community_ranking.score)).size).toBe(1);
});
