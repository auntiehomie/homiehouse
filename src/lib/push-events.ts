import type { PushPreferences } from './push-preferences';
interface PushCast { hash?: string; text?: string; timestamp?: string; parent_hash?: string; parentCastId?: unknown; parent_cast_id?: unknown; author?: { fid?: number; username?: string; display_name?: string } }
interface PushEvent { type?: string; timestamp?: string; most_recent_timestamp?: string; cast?: PushCast }
export function selectPushDigest(
  notifications: PushEvent[], casts: PushCast[], preferences: PushPreferences,
  lastNotification: string, lastCast: string, fid: number,
) {
  const notificationSince = Date.parse(lastNotification) || 0;
  const castSince = Date.parse(lastCast) || 0;
  let notificationTime = notificationSince;
  let castTime = castSince;
  const updates: { time: number; body: string; url: string; key: string }[] = [];
  for (const event of notifications) {
    const time = Date.parse(event.most_recent_timestamp || event.timestamp || '');
    if (!Number.isFinite(time) || time <= notificationSince) continue;
    notificationTime = Math.max(notificationTime, time);
    const reply = event.type === 'reply' || event.type === 'replies';
    const mention = event.type === 'mention' || event.type === 'mentions';
    if (!(reply && preferences.replies) && !(mention && preferences.mentions)) continue;
    const cast = event.cast;
    const name = cast?.author?.display_name || cast?.author?.username || 'Someone';
    updates.push({ time, key: `${event.type}:${cast?.hash || time}`, body: `${name} ${reply ? 'replied' : 'mentioned you'}: ${(cast?.text || '').slice(0, 100)}`, url: cast?.hash ? `/cast/${encodeURIComponent(cast.hash)}` : '/notifications' });
  }
  for (const cast of casts) {
    const time = Date.parse(cast.timestamp || '');
    if (!Number.isFinite(time) || time <= castSince) continue;
    castTime = Math.max(castTime, time);
    if (!preferences.newCasts || !cast.hash || cast.author?.fid === fid || cast.parent_hash || cast.parentCastId || cast.parent_cast_id) continue;
    updates.push({ time, key: `cast:${cast.hash}`, body: `${cast.author?.display_name || cast.author?.username || 'Someone'} cast: ${(cast.text || '').slice(0, 100)}`, url: `/cast/${encodeURIComponent(cast.hash)}` });
  }
  const unique = [...new Map(updates.map(update => [update.key, update])).values()].sort((a, b) => b.time - a.time);
  return {
    payload: unique.length ? { title: `${unique.length} new ${unique.length === 1 ? 'update' : 'updates'} on HomieHouse`, body: unique[0].body, url: unique[0].url } : null,
    notificationWatermark: new Date(notificationTime).toISOString(),
    castWatermark: new Date(castTime).toISOString(),
  };
}
