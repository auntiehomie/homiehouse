import { rankByLikes, preferenceStorage } from '../../src/lib/like-curation';
const now = Date.parse('2026-10-23T12:00:00Z');
const like = { type: 'like' as const, castHash: 'liked', authorFid: 99, text: 'privacy encryption', reactedAt: new Date(now).toISOString() };
const casts = [
  { hash: 'a', text: 'basketball scores', author: { fid: 1 } },
  { hash: 'b', text: 'privacy encryption', author: { fid: 2 } },
  { hash: 'c', text: 'cooking recipes', author: { fid: 3 } },
];
describe('like curation', () => {
  it('boosts related topics and preserves every cast without mutating inputs', () => {
    const result = rankByLikes(casts, [like], now);
    expect(result.map(c => c.hash)).toEqual(['b', 'a', 'c']);
    expect(casts[0].hash).toBe('a');
  });
  it('preserves order with no likes, recasts only, or expired likes', () => {
    expect(rankByLikes(casts, [], now)).toEqual(casts);
    expect(rankByLikes(casts, [{ ...like, type: 'recast' }], now)).toEqual(casts);
    expect(rankByLikes(casts, [{ ...like, reactedAt: '2020-01-01' }], now)).toEqual(casts);
  });
  it('ignores future and malformed dates and duplicate likes', () => {
    expect(rankByLikes(casts, [{ ...like, reactedAt: 'invalid' }, { ...like, reactedAt: '2030-01-01' }], now)).toEqual(casts);
    expect(rankByLikes(casts, [like, like], now)).toEqual(rankByLikes(casts, [like], now));
  });
  it('reserves a discovery slot and spreads authors', () => {
    const page = Array.from({ length: 10 }, (_, i) => ({ hash: String(i), text: i < 5 ? 'sports' : 'privacy encryption', author: { fid: i + 1 } }));
    const result = rankByLikes(page, [like], now);
    expect(result[4].hash).toBe('0');
    expect(new Set(result.map(c => c.hash)).size).toBe(10);
  });
  it('does not provide preference storage without an account', () => {
    expect(preferenceStorage(undefined)).toBeNull();
    expect(preferenceStorage(0)).toBeNull();
  });
});
