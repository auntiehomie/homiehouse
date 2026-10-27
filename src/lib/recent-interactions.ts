export type RecentInteractionType = 'like' | 'recast';

export interface RecentInteraction {
  type: RecentInteractionType;
  castHash: string;
  authorFid: number;
  authorUsername?: string;
  text: string;
  channelId?: string;
  reactedAt: string;
}

interface StoredInteractions {
  version: 1;
  items: RecentInteraction[];
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'hh_recent_interactions_v1';
const MAX_INTERACTIONS = 30;

function browserStorage(): StorageLike | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function cleanInteraction(value: RecentInteraction): RecentInteraction | null {
  if (!value.castHash || !value.text || !['like', 'recast'].includes(value.type)) return null;

  return {
    type: value.type,
    castHash: value.castHash.slice(0, 128),
    authorFid: Number.isSafeInteger(value.authorFid) ? value.authorFid : 0,
    authorUsername: value.authorUsername?.replace(/^@/, '').trim().slice(0, 40) || undefined,
    text: value.text.trim().slice(0, 1000),
    channelId: value.channelId?.replace(/^\//, '').trim().slice(0, 40) || undefined,
    reactedAt: value.reactedAt || new Date().toISOString(),
  };
}

export function loadRecentInteractions(storage: StorageLike | null = browserStorage()): RecentInteraction[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || 'null') as StoredInteractions | null;
    if (parsed?.version !== 1 || !Array.isArray(parsed.items)) return [];
    return parsed.items.flatMap((item) => {
      const cleaned = cleanInteraction(item);
      return cleaned ? [cleaned] : [];
    }).slice(0, MAX_INTERACTIONS);
  } catch {
    return [];
  }
}

export function rememberRecentInteraction(
  interaction: Omit<RecentInteraction, 'reactedAt'> & { reactedAt?: string },
  storage: StorageLike | null = browserStorage(),
): void {
  if (!storage) return;
  const cleaned = cleanInteraction({ ...interaction, reactedAt: interaction.reactedAt || new Date().toISOString() });
  if (!cleaned) return;

  const items = loadRecentInteractions(storage).filter(
    (item) => !(item.type === cleaned.type && item.castHash === cleaned.castHash),
  );
  const payload: StoredInteractions = { version: 1, items: [cleaned, ...items].slice(0, MAX_INTERACTIONS) };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be unavailable in private browsing or embedded clients.
  }
}

export function forgetRecentInteraction(
  type: RecentInteractionType,
  castHash: string,
  storage: StorageLike | null = browserStorage(),
): void {
  if (!storage) return;
  const payload: StoredInteractions = {
    version: 1,
    items: loadRecentInteractions(storage).filter(
      (item) => !(item.type === type && item.castHash === castHash),
    ),
  };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be unavailable in private browsing or embedded clients.
  }
}
