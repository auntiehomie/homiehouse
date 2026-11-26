import { selectPushDigest } from '@/lib/push-events';
const preferences = { replies: true, mentions: true, newCasts: false };
const since = '2026-01-01T00:00:00Z';
it('normalizes reply/mention aliases, applies preferences, and selects the newest event regardless of upstream order', () => {
 const result = selectPushDigest([
  { type: 'replies', timestamp: '2026-01-02T00:00:00Z', cast: { hash: 'a', text: 'Reply', author: { username: 'alice' } } },
  { type: 'mentions', timestamp: '2026-01-03T00:00:00Z', cast: { hash: 'b', text: 'Mention', author: { username: 'bob' } } },
  { type: 'likes', timestamp: '2026-01-04T00:00:00Z' },
 ], [], preferences, since, since, 12);
 expect(result.payload).toMatchObject({ title: '2 new updates on HomieHouse', body: 'bob mentioned you: Mention', url: '/cast/b' });
 expect(result.notificationWatermark).toBe('2026-01-04T00:00:00.000Z');
});
it('only includes followed-feed casts when explicitly opted in, excluding own casts and replies', () => {
 const casts = [{ hash: 'c', timestamp: '2026-01-05T00:00:00Z', text: 'New cast', author: { fid: 22, username: 'friend' } }];
 expect(selectPushDigest([], casts, preferences, since, since, 12).payload).toBeNull();
 expect(selectPushDigest([], casts, { ...preferences, newCasts: true }, since, since, 12).payload).toMatchObject({ url: '/cast/c' });
 expect(selectPushDigest([], [{ ...casts[0], author: { fid: 12 } }], { ...preferences, newCasts: true }, since, since, 12).payload).toBeNull();
 expect(selectPushDigest([], [{ ...casts[0], parent_hash: 'parent' }], { ...preferences, newCasts: true }, since, since, 12).payload).toBeNull();
});
it('does not notify for old, invalid-timestamp, or disabled events', () => {
 const result = selectPushDigest([
  { type: 'reply', timestamp: since }, { type: 'mention', timestamp: 'not-a-date' },
 ], [], preferences, since, since, 12);
 expect(result.payload).toBeNull();
});
