import { CAST_NAV_KEY, CAST_NAV_TTL, feedDestination, previousRoute, readCastNavigation, visitRoute, writeCastNavigation, type CastNavigation } from '@/lib/cast-navigation';

const empty = (): CastNavigation => ({ entries: [], index: -1, lastCast: null, ts: Date.now() });
const travel = (...paths: string[]) => paths.reduce(visitRoute, empty());

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
  } });
});

test('Back retraces nested casts before returning to the source feed', () => {
  let state = travel('/feed', '/cast/parent', '/cast/quoted');
  expect(previousRoute(state, '/cast/quoted')).toBe('/cast/parent');
  expect(feedDestination(state, '/cast/quoted')).toBe('/cast/parent');
  state = visitRoute(state, '/cast/parent');
  expect(previousRoute(state, '/cast/parent')).toBe('/feed');
  expect(feedDestination(state, '/cast/parent')).toBe('/feed');
});

test('Feed resumes the thread after visiting Compose or Learn', () => {
  const state = travel('/feed', '/cast/parent', '/compose', '/learn');
  expect(feedDestination(state, '/learn')).toBe('/cast/parent');
  const resumed = visitRoute(state, '/cast/parent');
  expect(previousRoute(resumed, '/cast/parent')).toBe('/feed');
});

test('native Back/Forward preserve scroll and the exact profile query', () => {
  let state = travel('/profile?fid=123&tab=replies', '/cast/parent');
  state.entries[1].scrollY = 880;
  state = visitRoute(visitRoute(state, '/profile?fid=123&tab=replies'), '/cast/parent');
  expect(state.entries[state.index].scrollY).toBe(880);
  expect(previousRoute(state, '/cast/parent')).toBe('/profile?fid=123&tab=replies');
});

test('leaving a conversation for the feed clears tab resume', () => {
  const state = travel('/feed', '/cast/parent', '/feed', '/learn');
  expect(feedDestination(state, '/learn')).toBe('/feed');
});

test('session survives reloads and rejects stale, malformed or external paths', () => {
  const state = travel('/feed', '/cast/parent');
  writeCastNavigation(state);
  expect(readCastNavigation().lastCast).toBe('/cast/parent');
  sessionStorage.setItem(CAST_NAV_KEY, JSON.stringify({ ...state, ts: Date.now() - CAST_NAV_TTL - 1 }));
  expect(readCastNavigation().entries).toEqual([]);
  sessionStorage.setItem(CAST_NAV_KEY, JSON.stringify({ ...state, entries: [{ path: '//evil.example', scrollY: 0 }] }));
  expect(readCastNavigation().entries).toEqual([]);
  sessionStorage.setItem(CAST_NAV_KEY, '{broken');
  expect(readCastNavigation().entries).toEqual([]);
  expect(visitRoute(state, 'javascript:alert(1)')).toEqual(state);
});

test('a direct cast link has a safe feed fallback and history is bounded', () => {
  expect(feedDestination(travel('/cast/direct'), '/cast/direct')).toBe('/feed');
  expect(previousRoute(travel('/cast/direct'), '/cast/direct')).toBeNull();
  const state = travel(...Array.from({ length: 80 }, (_, index) => `/cast/${index}`));
  expect(state.entries).toHaveLength(50);
  expect(state.index).toBe(49);
});
