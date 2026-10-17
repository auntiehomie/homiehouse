import type { FeedPosition } from './feed-scroll';

const KEY = 'hh_home_session_v1';
const TTL = 30 * 60 * 1000;
export interface HomeSession<P = unknown, C = unknown> {
  fid: number;
  progress: P | null;
  casts: C[];
  position: FeedPosition | null;
  ts: number;
}
// Retain the exact cards even when storage is full or disabled.
let current: HomeSession | null = null;

export function readHomeSession<P, C>(fid: number): HomeSession<P, C> | null {
  if (current?.fid === fid && (current.position || Date.now() - current.ts < TTL)) {
    return current as HomeSession<P, C>;
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (saved?.fid === fid && Number.isFinite(saved.ts) && Date.now() >= saved.ts && Date.now() - saved.ts < TTL
      && Array.isArray(saved.casts) && (saved.position === null || (
        typeof saved.position?.castHash === 'string' && Number.isFinite(saved.position.scrollY)
        && (saved.position.castOffset === null || Number.isFinite(saved.position.castOffset))
      ))) {
      current = saved;
      return saved;
    }
  } catch {}
  return null;
}

export function saveHomeSession<P, C>(state: HomeSession<P, C>) {
  current = state;
  try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

export function saveHomePosition(fid: number, position: FeedPosition) {
  const saved = readHomeSession(fid);
  if (saved) saveHomeSession({ ...saved, position, ts: Date.now() });
}

export function consumeHomePosition(fid: number, position: FeedPosition) {
  const saved = readHomeSession(fid);
  if (saved?.position === position) saveHomeSession({ ...saved, position: null, ts: Date.now() });
}
