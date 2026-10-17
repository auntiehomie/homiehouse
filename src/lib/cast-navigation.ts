/** Session-scoped navigation: preserve the thread across tab changes and reloads. */
export const CAST_NAV_KEY = 'hh_cast_navigation_v1';
export const CAST_NAV_TTL = 30 * 60 * 1000;
export type NavigationEntry = { path: string; scrollY: number };
export type CastNavigation = { entries: NavigationEntry[]; index: number; lastCast: string | null; ts: number };
let fallbackNavigation: CastNavigation | null = null;

export function isLocalPath(path: unknown): path is string {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !/[\\\r\n]/.test(path);
}

export function readCastNavigation(): CastNavigation {
  if (fallbackNavigation && Date.now() - fallbackNavigation.ts < CAST_NAV_TTL) return fallbackNavigation;
  try {
    const saved = JSON.parse(sessionStorage.getItem(CAST_NAV_KEY) || 'null');
    if (saved && Date.now() - saved.ts < CAST_NAV_TTL && Array.isArray(saved.entries)
      && saved.entries.every((entry: NavigationEntry) => isLocalPath(entry.path) && Number.isFinite(entry.scrollY))
      && Number.isInteger(saved.index) && saved.index >= 0 && saved.index < saved.entries.length) {
      return { ...saved, lastCast: isLocalPath(saved.lastCast) && saved.lastCast.startsWith('/cast/') ? saved.lastCast : null };
    }
  } catch {}
  return { entries: [], index: -1, lastCast: null, ts: Date.now() };
}

export function writeCastNavigation(state: CastNavigation) {
  const saved = { ...state, ts: Date.now() };
  try {
    sessionStorage.setItem(CAST_NAV_KEY, JSON.stringify(saved));
    fallbackNavigation = null;
  } catch { fallbackNavigation = saved; }
}

export function visitRoute(state: CastNavigation, path: string): CastNavigation {
  if (!isLocalPath(path)) return state;
  if (state.entries[state.index]?.path === path) return state;
  // Back/forward and explicit return links reuse the saved entry and its scroll.
  const existing = state.entries.findLastIndex(entry => entry.path === path);
  const entries = existing >= 0 ? state.entries : [...state.entries.slice(0, state.index + 1), { path, scrollY: 0 }].slice(-50);
  return { entries, index: existing >= 0 ? existing : entries.length - 1,
    lastCast: path.startsWith('/cast/') ? path : path === '/feed' ? null : state.lastCast, ts: Date.now() };
}

export function previousRoute(state: CastNavigation, current: string): string | null {
  return state.entries[state.index]?.path === current && state.index > 0
    ? state.entries[state.index - 1].path : null;
}

export function feedDestination(): string {
  // Feed is a destination, not a second Back button or a hidden thread resume.
  return '/feed';
}

export function pageScrollY(): number {
  return Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop);
}

export function scrollPageTo(top: number) {
  window.scrollTo({ top, behavior: 'instant' });
  // iOS can scroll the body when overflow-x creates a separate scroll container.
  document.body.scrollTop = top;
}
