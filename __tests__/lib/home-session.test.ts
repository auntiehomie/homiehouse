import type * as HomeSession from '@/lib/home-session';
let home: typeof HomeSession;
let data: Map<string, string>;
const position = { castHash: 'original', castOffset: 185, scrollY: 920 };
const snapshot = () => ({ fid: 321, progress: { hh2_points: 700 }, casts: [{ hash: 'original' }], position: null, ts: Date.now() });

beforeEach(() => {
  jest.resetModules();
  data = new Map();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: jest.fn((key: string) => data.get(key) || null),
    setItem: jest.fn((key: string, value: string) => data.set(key, value)),
  } });
  home = require('@/lib/home-session');
});
afterEach(() => jest.restoreAllMocks());

test('keeps the exact Home cards, learning state and anchor when storage writes fail', () => {
  jest.spyOn(sessionStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
  home.saveHomeSession(snapshot());
  home.saveHomePosition(321, position);
  expect(home.readHomeSession(321)).toMatchObject({ casts: [{ hash: 'original' }], progress: { hh2_points: 700 }, position });
  expect(home.readHomeSession(999)).toBeNull();
});

test('a long detail visit retains the active return and consumes only its own anchor', () => {
  home.saveHomeSession(snapshot());
  home.saveHomePosition(321, position);
  jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 45 * 60 * 1000);
  expect(home.readHomeSession(321)?.position).toEqual(position);
  home.consumeHomePosition(321, { ...position });
  expect(home.readHomeSession(321)?.position).toEqual(position);
  home.consumeHomePosition(321, home.readHomeSession(321)!.position!);
  expect(home.readHomeSession(321)?.position).toBeNull();
});

test('rehydrates a recent return after reload but rejects expired and malformed storage', () => {
  home.saveHomeSession(snapshot());
  home.saveHomePosition(321, position);
  jest.resetModules();
  home = require('@/lib/home-session');
  expect(home.readHomeSession(321)?.position).toEqual(position);
  jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * 60 * 1000);
  jest.resetModules();
  home = require('@/lib/home-session');
  expect(home.readHomeSession(321)).toBeNull();
  data.set('hh_home_session_v1', '{broken');
  expect(home.readHomeSession(321)).toBeNull();
});
