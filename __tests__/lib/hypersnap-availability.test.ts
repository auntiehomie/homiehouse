import { fetchFeed, fetchUserCastsPage, fetchCastConversation, searchCasts } from '@/lib/hypersnap';

const mockFetch = jest.fn();
const ok = (data: unknown) => ({ ok: true, json: async () => data });
beforeEach(() => { mockFetch.mockReset(); global.fetch = mockFetch; });

it('forwards the global cursor to native trending', async () => {
  mockFetch.mockResolvedValue(ok({ casts: [{ hash: 'second' }], next: { cursor: 'next' } }));
  const data = await fetchFeed({ feed_type: 'filter', filter_type: 'global_trending', cursor: 'page-2', limit: 25 });
  expect(mockFetch.mock.calls[0][0]).toContain('cursor=page-2');
  expect(data.next.cursor).toBe('next');
});
it('does not replace a completed following feed with unrelated casts', async () => {
  mockFetch.mockResolvedValue(ok({ casts: [], next: { cursor: null } }));
  expect((await fetchFeed({ fid: 123, cursor: 'end' })).casts).toEqual([]);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch.mock.calls[0][1].cache).toBe('no-store');
});
it('does not turn a node outage into a cached empty feed', async () => {
  mockFetch.mockRejectedValue(new Error('offline'));
  await expect(fetchFeed({ fid: 123 })).rejects.toThrow('unavailable');
});
it('uses the paginated native author endpoint and preserves its token', async () => {
  mockFetch.mockResolvedValue(ok({ casts: [], next: { cursor: 'hub-token' } }));
  expect((await fetchUserCastsPage(123, 25, 'token+2')).next.cursor).toBe('hub-token');
  expect(mockFetch.mock.calls[0][0]).toContain('/feed/user/casts?');
  expect(mockFetch.mock.calls[0][0]).toContain('cursor=token%2B2');
});
it('uses the fallback node when conversation reads fail', async () => {
  mockFetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(ok({ conversation: { cast: { hash: 'root' } } }));
  expect((await fetchCastConversation('root')).conversation.cast.hash).toBe('root');
  expect(mockFetch.mock.calls[1][1].cache).toBe('no-store');
});
it('passes search cursors to nodes that support them', async () => {
  mockFetch.mockResolvedValue(ok({ result: { casts: [{ hash: 'x' }], next: { cursor: 'next' } } }));
  expect((await searchCasts('hello', 10, 'page-2')).next.cursor).toBe('next');
  expect(mockFetch.mock.calls[0][0]).toContain('cursor=page-2');
});
it('reads channel discovery directly from the node without OpenRank', async () => {
  mockFetch.mockResolvedValue(ok({ casts: [{ hash: 'unranked' }], next: { cursor: 'older' } }));
  const data = await fetchFeed({ feed_type: 'filter', filter_type: 'global_trending', channel_id: 'test', cursor: 'before' });
  expect(mockFetch.mock.calls[0][0]).toContain('/feed/channels?');
  expect(mockFetch.mock.calls[0][0]).toContain('cursor=before');
  expect(data.casts[0].hash).toBe('unranked');
  expect(mockFetch).toHaveBeenCalledTimes(1);
});
