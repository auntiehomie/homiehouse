export interface SavedChannel {
  id: string;
  name?: string;
  image_url?: string | null;
}

export const CHANNELS_UPDATED_EVENT = 'hh:channels:updated';

const STORAGE_PREFIX = 'hh_saved_channels_v1';

function storageKey(fid: number | string): string {
  return `${STORAGE_PREFIX}:${String(fid)}`;
}

function getStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeChannel(value: unknown): SavedChannel | null {
  if (!value || typeof value !== 'object') return null;
  const channel = value as Record<string, unknown>;
  const id = typeof channel.id === 'string' ? channel.id.trim().replace(/^\//, '') : '';
  if (!id) return null;
  return {
    id,
    ...(typeof channel.name === 'string' && channel.name.trim() ? { name: channel.name.trim() } : {}),
    ...(typeof channel.image_url === 'string' ? { image_url: channel.image_url } : {}),
  };
}

export function readSavedChannels(fid: number | string, storage?: Storage | null): SavedChannel[] {
  const target = getStorage(storage);
  if (!target || !String(fid).trim()) return [];
  try {
    const value = target.getItem(storageKey(fid));
    const parsed: unknown = value ? JSON.parse(value) : [];
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.flatMap(item => {
      const channel = normalizeChannel(item);
      if (!channel || seen.has(channel.id.toLowerCase())) return [];
      seen.add(channel.id.toLowerCase());
      return [channel];
    });
  } catch {
    return [];
  }
}

function writeSavedChannels(fid: number | string, channels: SavedChannel[], storage?: Storage | null): SavedChannel[] {
  const target = getStorage(storage);
  const normalized = channels.flatMap(channel => {
    const valid = normalizeChannel(channel);
    return valid ? [valid] : [];
  });
  if (!target || !String(fid).trim()) return normalized;
  try {
    target.setItem(storageKey(fid), JSON.stringify(normalized));
    if (typeof window !== 'undefined' && target === window.localStorage) {
      window.dispatchEvent(new CustomEvent(CHANNELS_UPDATED_EVENT, { detail: { fid: String(fid) } }));
    }
  } catch {
    // Keep the in-memory result useful when browser storage is unavailable.
  }
  return normalized;
}

export function addSavedChannel(
  fid: number | string,
  channel: SavedChannel,
  storage?: Storage | null,
): SavedChannel[] {
  const normalized = normalizeChannel(channel);
  if (!normalized) return readSavedChannels(fid, storage);
  const existing = readSavedChannels(fid, storage);
  const next = [normalized, ...existing.filter(item => item.id.toLowerCase() !== normalized.id.toLowerCase())];
  return writeSavedChannels(fid, next, storage);
}

export function removeSavedChannel(
  fid: number | string,
  channelId: string,
  storage?: Storage | null,
): SavedChannel[] {
  const id = channelId.trim().replace(/^\//, '').toLowerCase();
  return writeSavedChannels(
    fid,
    readSavedChannels(fid, storage).filter(channel => channel.id.toLowerCase() !== id),
    storage,
  );
}
