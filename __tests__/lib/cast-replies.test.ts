import { fetchDirectReplies } from '@/lib/cast-replies';
import { hypersnapFetch, fallbackFetch } from '@/lib/hypersnap';
jest.mock('@/lib/hypersnap', () => ({ hypersnapFetch: jest.fn(), fallbackFetch: jest.fn() }));
const primary = hypersnapFetch as jest.Mock;
const fallback = fallbackFetch as jest.Mock;
beforeEach(() => jest.resetAllMocks());
it('pages raw replies with one bulk author lookup and retains unknown authors', async () => {
  primary.mockResolvedValueOnce({ messages: [
    { hash: 'reply', data: { fid: 456, timestamp: 1, castAddBody: { text: 'visible', embeds: [{ url: 'https://example.com' }] } } },
    { hash: 'unknown', data: { fid: 789, timestamp: 2, castAddBody: { text: 'also visible' } } },
  ], nextPageToken: 'next+page=' }).mockResolvedValueOnce({ users: [{ fid: 456, username: 'author' }] });
  const page = await fetchDirectReplies(123, 'root', 'opaque+token=');
  expect(primary.mock.calls[0][0]).toContain('pageToken=opaque%2Btoken%3D');
  expect(primary.mock.calls[1][0]).toContain('fids=456,789');
  expect(page.casts).toHaveLength(2);
  expect(page.casts[0].timestamp).toBe('2021-01-01T00:00:01.000Z');
  expect(page.casts[1].author.fid).toBe(789);
  expect(page.next?.cursor).toBe('next+page=');
  expect(primary).toHaveBeenCalledTimes(2);
});
it('keeps failed pages retryable', async () => {
  primary.mockRejectedValue(new Error('offline'));
  fallback.mockResolvedValue(null);
  await expect(fetchDirectReplies(123, 'root')).rejects.toThrow('unavailable');
});
it('accepts an empty final page without treating it as an outage', async () => {
  primary.mockResolvedValue({ messages: [], nextPageToken: '' });
  expect(await fetchDirectReplies(123, 'root')).toEqual({ casts: [], next: null });
  expect(fallback).not.toHaveBeenCalled();
});
