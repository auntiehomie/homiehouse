import { rankByLikes, preferenceStorage, defaultTuning, loadFeedTuning, saveFeedTuning, recordFeedFeedback } from '../../src/lib/like-curation';
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

describe('explicit feed tuning', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  beforeEach(() => { values.clear(); Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } }); });
  afterEach(() => { Reflect.deleteProperty(globalThis, 'window'); });
  it('boosts and demotes related casts without dropping candidates', () => {
    const feedback = { hash: 'sample', text: 'privacy encryption', authorFid: 99, direction: 1 as const };
    expect(rankByLikes(casts, [], now, { ...defaultTuning(), feedback: [feedback] })[0].hash).toBe('b');
    const result = rankByLikes(casts, [], now, { ...defaultTuning(), feedback: [{ ...feedback, direction: -1 }] });
    expect(result.map(c => c.hash)).toEqual(['a', 'c', 'b']);
  });
  it('reserves more original-order slots in explore mode', () => {
    const page = Array.from({ length: 10 }, (_, i) => ({ hash: String(i), text: i < 5 ? 'sports' : 'privacy encryption', author: { fid: i + 1 } }));
    expect(rankByLikes(page, [like], now, { ...defaultTuning(), discovery: 'explore' })[1].hash).toBe('0');
    expect(rankByLikes(page, [like], now, { ...defaultTuning(), discovery: 'focused' })[1].hash).toBe('6');
  });
  it('isolates accounts, replaces feedback and resets explicit tuning', () => {
    values.clear();
    expect(recordFeedFeedback(1, casts[1], 1)).toBe(true);
    expect(recordFeedFeedback(1, casts[1], -1)).toBe(true);
    expect(loadFeedTuning(1).feedback).toHaveLength(1);
    expect(loadFeedTuning(1).feedback[0].direction).toBe(-1);
    expect(loadFeedTuning(2)).toEqual(defaultTuning());
    saveFeedTuning(1, defaultTuning());
    expect(loadFeedTuning(1)).toEqual(defaultTuning());
  });
  it('handles malformed or unavailable storage', () => {
    preferenceStorage(1)?.setItem('hh_feed_tuning_v1', '{');
    expect(loadFeedTuning(1)).toEqual(defaultTuning());
    expect(saveFeedTuning(undefined, defaultTuning())).toBe(false);
    const spy = jest.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(recordFeedFeedback(1, casts[0], 1)).toBe(false);
    spy.mockRestore();
  });
});
