export interface PushPreferences { replies: boolean; mentions: boolean; newCasts: boolean }
export const DEFAULT_PUSH_PREFERENCES: PushPreferences = { replies: true, mentions: true, newCasts: false };
export function parsePushPreferences(value: unknown): PushPreferences | null {
  if (value === undefined) return { ...DEFAULT_PUSH_PREFERENCES };
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (['replies', 'mentions', 'newCasts'].some(key => typeof item[key] !== 'boolean')) return null;
  return { replies: item.replies as boolean, mentions: item.mentions as boolean, newCasts: item.newCasts as boolean };
}
export function readPushPreferences(fid: number): PushPreferences {
  try { return parsePushPreferences(JSON.parse(localStorage.getItem(`hh_push_preferences:${fid}`) || 'null')) || { ...DEFAULT_PUSH_PREFERENCES }; }
  catch { return { ...DEFAULT_PUSH_PREFERENCES }; }
}
