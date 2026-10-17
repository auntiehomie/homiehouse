/** Keep navigation snapshots in this tab's memory; browser storage is optional. */
export const FEED_RETURN_TTL = 30 * 60 * 1000;
const RETURN_KEY = 'hh_feed_return_v2';
export interface FeedSnapshot<T = unknown> {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
  ts: number;
}
export interface FeedReturn {
  snapshotKey: string;
  owner: string;
  feedType: 'global' | 'following';
  selectedChannel: string | null;
  castHash: string;
  castOffset: number | null;
  scrollY: number;
  ts: number;
}
const snapshots = new Map<string, FeedSnapshot>();
let pendingReturn: FeedReturn | null | undefined;

function owner(): string {
  try { return String(JSON.parse(localStorage.getItem('hh_profile') || '{}').fid || 'guest'); }
  catch { return 'guest'; }
}
export function feedSnapshotKey(feedType: string, channel: string | null): string {
  return `hh_feed_snapshot_v2:${owner()}:${feedType}:${channel ?? 'all'}`;
}
function recent(ts: unknown, age: number): boolean {
  return typeof ts === 'number' && Date.now() >= ts && Date.now() - ts < age;
}
function remember(key: string, snapshot: FeedSnapshot) {
  snapshots.delete(key);
  snapshots.set(key, snapshot);
  if (snapshots.size > 4) snapshots.delete(snapshots.keys().next().value!);
}
export function saveFeedSnapshot<T>(key: string, snapshot: FeedSnapshot<T>) {
  // Do this before serializing: quota/privacy/serialization errors cannot lose the list.
  remember(key, snapshot);
  try { sessionStorage.setItem(key, JSON.stringify(snapshot)); } catch {}
}
export function readFeedSnapshot<T = unknown>(key: string, maxAge = 5 * 60 * 1000): FeedSnapshot<T> | null {
  let snapshot = snapshots.get(key);
  if (!snapshot) {
    try { snapshot = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch {}
  }
  const activeReturn = snapshots.has(key) && pendingReturn?.snapshotKey === key && pendingReturn.owner === owner();
  if (!snapshot || !Array.isArray(snapshot.items) || typeof snapshot.hasMore !== 'boolean'
    || (snapshot.cursor !== null && typeof snapshot.cursor !== 'string') || (!activeReturn && !recent(snapshot.ts, maxAge))) return null;
  remember(key, snapshot);
  return snapshot as FeedSnapshot<T>;
}
export function saveFeedReturn<T>(state: Omit<FeedReturn, 'owner' | 'ts'>, snapshot: Omit<FeedSnapshot<T>, 'ts'>) {
  const ts = Date.now();
  pendingReturn = { ...state, owner: owner(), ts };
  // Write the small return marker separately, before the potentially large snapshot.
  try { sessionStorage.setItem(RETURN_KEY, JSON.stringify(pendingReturn)); } catch {}
  saveFeedSnapshot(state.snapshotKey, { ...snapshot, ts });
}
export function readFeedReturn(): FeedReturn | null {
  if (pendingReturn === undefined) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(RETURN_KEY) || 'null');
      pendingReturn = saved && recent(saved.ts, FEED_RETURN_TTL) ? saved : null;
    }
    catch { return null; }
  }
  // An active in-tab return never expires while the user is reading a cast.
  // The TTL only bounds rehydration after a full reload loses module memory.
  const saved = pendingReturn;
  return saved && saved.owner === owner()
    && (saved.feedType === 'global' || saved.feedType === 'following')
    && typeof saved.snapshotKey === 'string' && typeof saved.castHash === 'string'
    && (saved.selectedChannel === null || typeof saved.selectedChannel === 'string')
    && Number.isFinite(saved.scrollY) && (saved.castOffset === null || Number.isFinite(saved.castOffset))
    ? saved : null;
}
export function consumeFeedReturn(expected: FeedReturn) {
  const saved = readFeedReturn();
  if (saved?.ts !== expected.ts || saved?.castHash !== expected.castHash || saved?.snapshotKey !== expected.snapshotKey) return;
  pendingReturn = null;
  try { sessionStorage.removeItem(RETURN_KEY); } catch {}
}
